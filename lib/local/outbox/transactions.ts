import { ApiError } from "@/lib/api/errors";
import { dayKey } from "@/lib/format/dates";
import type {
  BatchUpdateFailure,
  BatchUpdateResult,
  BatchUpdateTransactionsInput,
  CreateTransactionInput,
  QuickAddTransactionInput,
  SharedExpense,
  SyncTransaction,
  Transaction,
  UpdateTransactionInput,
} from "@/types/api";

import { carriedExpense, SplitInvalidError } from "../derive/shared";
import { toApiRow } from "../repository/transactions";
import { sharedExpenseRecord, transactionRecord } from "../schema";
import type { MoneyEffect } from "./envelope";
import {
  balanceOf,
  defaultAccountId,
  NotProjectableError,
  patch,
  projectionContext,
  refused,
} from "./projected";
import { refuseLoanInCredit } from "./projection";
import {
  dependenciesOf,
  type LocalChange,
  unsent,
  type VaultDb,
  type WriteTransaction,
} from "./queue";
import { reconcileRow } from "./reconcile";
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
  const effect = { before: previous ? balanceOf(previous.row) : null, after: balanceOf(next) };
  await refuseLoanInCredit(tx, effect);
  await store.put(transactionRecord(next, previous ? (previous.server ?? previous.row) : next));
  const guarded = previous !== undefined && !(await unsent(tx, "transaction", id));
  const dependsOn = await dependenciesOf(tx, [
    { entity: "account", id: next.fromAccountId },
    { entity: "account", id: next.toAccountId },
    { entity: "category", id: next.categoryId },
  ]);
  return {
    effect,
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

const sameInstant = (left: string, right: string): boolean =>
  Date.parse(left) === Date.parse(right);

async function guestsHavePaid(tx: WriteTransaction, expenseId: string): Promise<boolean> {
  const settlements = await tx.objectStore("settlements").getAll();
  return settlements.some(
    (record) => record.row.deletedAt === null && record.row.counterparty.expenseId === expenseId,
  );
}

function carriedBy(expense: SharedExpense, next: SyncTransaction): SharedExpense | null {
  if (next.deletedAt !== null) return { ...expense, deletedAt: next.deletedAt };
  if (next.type !== "EXPENSE") {
    throw refused("TRANSACTION_NOT_SPLITTABLE", "Only an expense can be split with other people");
  }
  if (
    next.amount === expense.amount &&
    sameInstant(next.date, expense.date) &&
    next.description === expense.description
  ) {
    return null;
  }
  try {
    return carriedExpense(expense, {
      amount: next.amount,
      date: next.date,
      description: next.description,
    });
  } catch (error) {
    if (error instanceof SplitInvalidError) throw refused("SPLIT_INVALID", error.message);
    throw error;
  }
}

// The server writes a movement's shared expense in the same request, and refuses what it would.
async function carryToExpense(tx: WriteTransaction, next: SyncTransaction): Promise<string | null> {
  const expenseId = next.sharedExpenseId;
  if (expenseId === null) return null;
  const store = tx.objectStore("sharedExpenses");
  const record = await store.get(expenseId);
  if (!record)
    throw new NotProjectableError(`shared expense ${expenseId} of transaction ${next.id}`);
  if (record.row.deletedAt !== null) return null;
  if (next.deletedAt !== null && (await guestsHavePaid(tx, expenseId))) {
    throw refused(
      "GUEST_BLOCK_HAS_PAYMENTS",
      "Its block of guests has paid: undo those payments first, and then this can go",
    );
  }
  const carried = carriedBy(record.row, next);
  if (carried === null) return null;
  await store.put(sharedExpenseRecord(carried, record.server ?? record.row));
  return expenseId;
}

// The refused operation is already off the queue, so the expense is restated rather than restored.
function withCarried(change: LocalChange, sharedExpenseId: string | null): LocalChange {
  if (sharedExpenseId === null) return change;
  return {
    ...change,
    sharedExpenseId,
    undo: async (undoTx) => {
      await change.undo(undoTx);
      await reconcileRow(undoTx, "sharedExpense", sharedExpenseId);
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
        const carried = await carryToExpense(tx, next);
        const { change, effect } = await projectTransaction(tx, id, next);
        return { ...withCarried(change, carried), effect };
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
        const carried = await carryToExpense(tx, next);
        const { change, effect } = await projectTransaction(tx, id, next);
        return { ...withCarried(change, carried), effect };
      },
    },
    optimistic: () => null,
  });
}
