import { ApiError } from "@/lib/api/errors";
import { dayKey } from "@/lib/format/dates";
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

// The mirror no longer holds the replaced row, so what the figure moved is recorded with it.
async function projectTransaction(
  tx: WriteTransaction,
  id: string,
  next: SyncTransaction,
): Promise<Projected> {
  const store = tx.objectStore("transactions");
  const previous = await store.get(id);
  await store.put(transactionRecord(next, previous ? (previous.server ?? previous.row) : next));
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
  owner: { userId: string; currency: string; timeZone: string },
  source: SyncTransaction["source"],
  pendingDetails: boolean,
  createdAt: string,
): SyncTransaction {
  return {
    id,
    type: input.type,
    amount: input.amount,
    date: input.date,
    dayKey: dayKey(new Date(input.date), owner.timeZone),
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
    // A movement created here is in no group yet, so the whole amount is what counts as yours.
    countsAsYours: input.amount,
    sharedExpenseId: null,
    sharedGroupId: null,
    sharedSettlementId: null,
    importedFromGroupId: null,
    importedFromExpenseId: null,
    sharedHistory: [],
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

// O-B1: a create carrying an id is already idempotent, so the key is the row's id, not a header.
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
        // The server's own defaults, restated because the mirror shows the row it will send back.
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
      project: async (tx, occurredAt) => {
        const next = patch(await currentRow(tx, id), input);
        // The day only moves when the date does, and only then is the profile needed.
        if (input.date !== undefined) {
          const { timeZone } = await projectionContext(tx, occurredAt);
          next.dayKey = dayKey(new Date(next.date), timeZone);
        }
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

// F-20: an envelope carries one entity and one `If-Match`, so the lot expands into N operations.
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
        // A tombstone keeps no `liveDate`, so the row leaves every window the moment it is written.
        const next = { ...(await currentRow(tx, id)), deletedAt: occurredAt };
        const { change, effect } = await projectTransaction(tx, id, next);
        return { ...change, effect };
      },
    },
    optimistic: () => null,
  });
}
