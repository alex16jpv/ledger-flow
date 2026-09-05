import { api } from "@/lib/api/client";
import type {
  CreateTransactionInput,
  QuickAddTransactionInput,
  SyncTransaction,
  Transaction,
  UpdateTransactionInput,
} from "@/types/api";

import { toApiRow } from "../repository/transactions";
import { transactionRecord } from "../schema";
import type { MoneyEffect } from "./envelope";
import {
  balanceOf,
  defaultAccountId,
  NotProjectableError,
  patch,
  projectionContext,
} from "./projected";
import {
  dependenciesOf,
  type LocalChange,
  unsent,
  type VaultDb,
  type WriteTransaction,
} from "./queue";
import { write, type WriteGuard } from "./write";

const ifMatch = (guard: WriteGuard) =>
  guard.ifMatch ? { headers: { "If-Match": guard.ifMatch } } : {};

async function currentRow(tx: WriteTransaction, id: string): Promise<SyncTransaction> {
  const record = await tx.objectStore("transactions").get(id);
  if (!record) throw new NotProjectableError(`transaction ${id}, which the mirror does not hold`);
  return record.row;
}

interface Projected {
  change: LocalChange;
  effect: MoneyEffect;
}

// The one place a movement enters the mirror before the server has it. Besides the row it records
// what the figure moved: the projection of the balances is the mirror's `balance` plus these, and
// the mirror no longer holds the row the operation replaced.
async function projectTransaction(
  tx: WriteTransaction,
  id: string,
  next: SyncTransaction,
): Promise<Projected> {
  const store = tx.objectStore("transactions");
  const previous = await store.get(id);
  await store.put(transactionRecord(next));
  const guarded = previous !== undefined && !(await unsent(tx, "transaction", id));
  const dependsOn = await dependenciesOf(tx, [
    { entity: "account", id: next.fromAccountId },
    { entity: "account", id: next.toAccountId },
    { entity: "category", id: next.categoryId },
  ]);
  return {
    effect: { before: previous ? balanceOf(previous.row) : null, after: balanceOf(next) },
    change: {
      ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
      dependsOn,
      undo: async (undoTx) => {
        const undone = undoTx.objectStore("transactions");
        if (previous) await undone.put(previous);
        else await undone.delete(id);
      },
    },
  };
}

const readBack =
  (id: string) =>
  async (db: VaultDb): Promise<Transaction> => {
    const record = await db.get("transactions", id);
    if (!record) throw new NotProjectableError(`transaction ${id} after queueing it`);
    return toApiRow(record.row);
  };

function newRow(
  input: CreateTransactionInput,
  id: string,
  owner: { userId: string; currency: string },
  source: SyncTransaction["source"],
  pendingDetails: boolean,
  createdAt: string,
): SyncTransaction {
  return {
    id,
    type: input.type,
    amount: input.amount,
    date: input.date,
    categoryId: input.categoryId ?? null,
    description: input.description ?? null,
    fromAccountId: input.fromAccountId ?? null,
    toAccountId: input.toAccountId ?? null,
    userId: owner.userId,
    tags: input.tags ?? [],
    note: input.note ?? null,
    pendingDetails,
    source,
    currency: owner.currency,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

// `idempotencyKey` is the row's id now, not a header: a create carrying an id is already idempotent
// (O-B1), and one key per distinct payload still means a retried form names the same row.
export function createTransaction(
  input: CreateTransactionInput,
  idempotencyKey: string,
): Promise<Transaction> {
  const id = input.id ?? idempotencyKey;
  const body: CreateTransactionInput = { ...input, id };
  return write<Transaction>({
    local: {
      entity: "transaction",
      entityId: id,
      action: "create",
      payload: { body },
      project: async (tx, occurredAt) => {
        const owner = await projectionContext(tx, occurredAt);
        const row = newRow(body, id, owner, "MANUAL", false, occurredAt);
        const { change, effect } = await projectTransaction(tx, id, row);
        return { ...change, effect };
      },
    },
    send: () => api<Transaction>("/transactions", { method: "POST", body }),
    confirm: async (tx, result) => {
      await tx.objectStore("transactions").put(transactionRecord({ ...result, deletedAt: null }));
    },
    optimistic: readBack(id),
  });
}

export function quickAddTransaction(
  input: QuickAddTransactionInput,
  idempotencyKey: string,
): Promise<Transaction> {
  const id = input.id ?? idempotencyKey;
  const body: QuickAddTransactionInput = { ...input, id };
  return write<Transaction>({
    local: {
      entity: "transaction",
      entityId: id,
      action: "quickAdd",
      payload: { body },
      project: async (tx, occurredAt) => {
        const owner = await projectionContext(tx, occurredAt);
        // The server's own defaults, restated because the mirror has to show the same row it will
        // send back: EXPENSE, now, and the default account on whichever side is missing.
        const type = body.type ?? "EXPENSE";
        const needsFrom = (type === "EXPENSE" || type === "TRANSFER") && !body.fromAccountId;
        const needsTo = type === "INCOME" && !body.toAccountId;
        const fallback = needsFrom || needsTo ? await defaultAccountId(tx) : null;
        if ((needsFrom || needsTo) && !fallback) {
          throw new NotProjectableError("a quick capture with no default account");
        }
        const row = newRow(
          {
            type,
            amount: body.amount,
            date: body.date ?? occurredAt,
            categoryId: body.categoryId ?? null,
            fromAccountId: needsFrom ? fallback : (body.fromAccountId ?? null),
            toAccountId: needsTo ? fallback : (body.toAccountId ?? null),
          },
          id,
          owner,
          "QUICK",
          true,
          occurredAt,
        );
        const { change, effect } = await projectTransaction(tx, id, row);
        return { ...change, effect };
      },
    },
    send: () => api<Transaction>("/transactions/quick", { method: "POST", body }),
    confirm: async (tx, result) => {
      await tx.objectStore("transactions").put(transactionRecord({ ...result, deletedAt: null }));
    },
    optimistic: readBack(id),
  });
}

export function updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
  return write<Transaction>({
    local: {
      entity: "transaction",
      entityId: id,
      action: "update",
      payload: { body: input },
      project: async (tx) => {
        const next = patch(await currentRow(tx, id), input);
        const { change, effect } = await projectTransaction(tx, id, next);
        return { ...change, effect };
      },
    },
    send: (guard) =>
      api<Transaction>(`/transactions/${id}`, { method: "PUT", body: input, ...ifMatch(guard) }),
    confirm: async (tx, result) => {
      await tx.objectStore("transactions").put(transactionRecord({ ...result, deletedAt: null }));
    },
    optimistic: readBack(id),
  });
}

export function deleteTransaction(id: string): Promise<unknown> {
  return write<unknown>({
    local: {
      entity: "transaction",
      entityId: id,
      action: "delete",
      payload: {},
      project: async (tx, occurredAt) => {
        // A tombstone keeps no `liveDate`, so the row leaves the list and every window the moment
        // it is written, exactly as a deleted row from the feed does.
        const next = { ...(await currentRow(tx, id)), deletedAt: occurredAt };
        const { change, effect } = await projectTransaction(tx, id, next);
        return { ...change, effect };
      },
    },
    send: (guard) => api<unknown>(`/transactions/${id}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: () => undefined,
    optimistic: () => null,
  });
}
