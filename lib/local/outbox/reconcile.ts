import type {
  Account,
  Category,
  Contact,
  Settlement,
  SharedExpense,
  SyncBudget,
  SyncSharedGroup,
  SyncTransaction,
} from "@/types/api";

import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  contactRecord,
  type OutboxEntity,
  type OutboxOperation,
  PROFILE_KEY,
  settlementRecord,
  sharedExpenseRecord,
  sharedGroupRecord,
  transactionRecord,
} from "../schema";
import { type MoneyEffect, operationPayload } from "./envelope";
import { balanceOf } from "./projected";
import type { WriteTransaction } from "./queue";
import {
  applyOperation,
  type MirrorRow,
  type QueuedMirror,
  queuedMirror,
  reprojectWalk,
  rowKey,
} from "./reproject";

const STORE_OF = {
  account: "accounts",
  category: "categories",
  transaction: "transactions",
  budget: "budgets",
  contact: "contacts",
  sharedGroup: "sharedGroups",
  sharedExpense: "sharedExpenses",
  settlement: "settlements",
} as const satisfies Record<OutboxEntity, string>;

const isCreate = (action: string): boolean => action === "create" || action === "quickAdd";

// The queue as it stands, read once for a whole page of the feed rather than once per row.
export interface ReconcileContext {
  outbox: OutboxOperation[];
  queued: QueuedMirror;
}

export async function reconcileContext(tx: WriteTransaction): Promise<ReconcileContext> {
  const outbox = await tx.objectStore("outbox").getAll();
  const timezone = (await tx.objectStore("profile").get(PROFILE_KEY))?.row.timezone ?? null;
  return { outbox, queued: queuedMirror(outbox, timezone) };
}

const sameEffect = (left: MoneyEffect | undefined, right: MoneyEffect): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right);

// D-24: everything that learns something about a row comes through here, so nothing drifts.
export async function reconcileRow(
  tx: WriteTransaction,
  entity: OutboxEntity,
  id: string,
  server?: MirrorRow,
  context?: ReconcileContext,
): Promise<void> {
  const store = tx.objectStore(STORE_OF[entity]);
  const record = server === undefined ? await store.get(id) : undefined;
  const baseline: MirrorRow | undefined = server ?? record?.server ?? record?.row;
  if (!baseline) return;
  const { outbox, queued } = context ?? (await reconcileContext(tx));
  const mine = outbox.filter((op) => op.entity === entity && op.entityId === id);
  const { row, steps } = reprojectWalk(entity, baseline, queued);
  const kept = queued.touched.has(rowKey(entity, id)) ? baseline : undefined;

  if (entity === "account") {
    await tx.objectStore("accounts").put(accountRecord(row as Account, kept as Account));
  } else if (entity === "category") {
    await tx.objectStore("categories").put(categoryRecord(row as Category, kept as Category));
  } else if (entity === "budget") {
    await tx.objectStore("budgets").put(budgetRecord(row as SyncBudget, kept as SyncBudget));
  } else if (entity === "contact") {
    await tx.objectStore("contacts").put(contactRecord(row as Contact, kept as Contact));
  } else if (entity === "sharedGroup") {
    await tx
      .objectStore("sharedGroups")
      .put(sharedGroupRecord(row as SyncSharedGroup, kept as SyncSharedGroup));
  } else if (entity === "sharedExpense") {
    await tx
      .objectStore("sharedExpenses")
      .put(sharedExpenseRecord(row as SharedExpense, kept as SharedExpense));
  } else if (entity === "settlement") {
    await tx
      .objectStore("settlements")
      .put(settlementRecord(row as Settlement, kept as Settlement));
  } else {
    await tx
      .objectStore("transactions")
      .put(transactionRecord(row as SyncTransaction, kept as SyncTransaction));
  }

  const carried = entity === "transaction" ? (row as SyncTransaction).sharedExpenseId : null;
  // A refused, conflicting or discarded edit stops writing the expense it carried: it looks again.
  if (
    carried !== null &&
    (queued.touched.has(rowKey("sharedExpense", carried)) ||
      (await tx.objectStore("sharedExpenses").get(carried))?.server !== undefined)
  ) {
    await reconcileRow(tx, "sharedExpense", carried, undefined, { outbox, queued });
  }

  // Each effect starts from the server's row just brought, and only when the server has it.
  if (entity !== "transaction" || mine.some((op) => isCreate(op.action))) return;
  const outboxStore = tx.objectStore("outbox");
  for (const step of steps) {
    const effect: MoneyEffect = {
      before: balanceOf(step.before as SyncTransaction),
      after: balanceOf(step.after as SyncTransaction),
    };
    const payload = operationPayload(step.operation);
    if (sameEffect(payload.effect, effect)) continue;
    await outboxStore.put({ ...step.operation, payload: { ...payload, effect } });
  }
}

// The server wrote the movement's expense in the same request, so that baseline moves as well.
export async function reconcileCarried(
  tx: WriteTransaction,
  operation: OutboxOperation,
): Promise<void> {
  const { sharedExpenseId } = operationPayload(operation);
  if (sharedExpenseId === undefined) return;
  const record = await tx.objectStore("sharedExpenses").get(sharedExpenseId);
  const baseline = record?.server ?? record?.row;
  if (!baseline) return;
  const context = await reconcileContext(tx);
  await reconcileRow(
    tx,
    "sharedExpense",
    sharedExpenseId,
    applyOperation("sharedExpense", baseline, operation, context.queued),
    context,
  );
}

// The server did it and nothing else says so until the next pull, so the baseline moves.
export async function reconcileRemoval(
  tx: WriteTransaction,
  operation: OutboxOperation,
): Promise<void> {
  const { entity, entityId } = operation;
  const record = await tx.objectStore(STORE_OF[entity]).get(entityId);
  const baseline: MirrorRow | undefined = record?.server ?? record?.row;
  if (!baseline) return;
  const context = await reconcileContext(tx);
  await reconcileRow(
    tx,
    entity,
    entityId,
    applyOperation(entity, baseline, operation, context.queued),
    context,
  );
  await reconcileCarried(tx, operation);
}
