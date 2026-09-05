import { ApiError } from "@/lib/api/errors";
import type {
  BatchUpdateFailure,
  BatchUpdateResult,
  BatchUpdateTransactionsInput,
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
import { write, writeAll, type WriteRequest } from "./write";

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
    optimistic: readBack(id),
  });
}

function updateRequest(id: string, input: UpdateTransactionInput): WriteRequest<Transaction> {
  return {
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
    optimistic: readBack(id),
  };
}

export function updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
  return write(updateRequest(id, input));
}

// F-20: the batch endpoint addresses N rows with one request, and an envelope carries one entity and
// one `If-Match`. So the lot enters the queue expanded into N `transaction:update` operations — each
// row with its own guard, its own conflict and its own place in the order — and the screen still
// gets the `{ updated, failed }` it always read. Online this is N requests where it used to be one:
// the price of a row-by-row guard, and of the review tray working with no network at all.
export async function batchUpdateTransactions(
  input: BatchUpdateTransactionsInput,
): Promise<BatchUpdateResult> {
  const settled = await writeAll(
    input.items.map(({ id, ...changes }) => updateRequest(id, changes)),
  );
  const updated: Transaction[] = [];
  const failed: BatchUpdateFailure[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      updated.push(result.value);
      return;
    }
    const reason: unknown = result.reason;
    const code = reason instanceof ApiError ? reason.code : null;
    failed.push({
      // The screen maps `code` to its own message; this one is the server's own words, kept for logs.
      id: input.items[index]?.id ?? "",
      code: code ?? "INTERNAL",
      message: reason instanceof Error ? reason.message : "",
    });
  });
  return { updated, failed };
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
    optimistic: () => null,
  });
}
