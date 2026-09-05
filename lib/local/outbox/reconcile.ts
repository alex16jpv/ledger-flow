import type { Account, Category, SyncBudget, SyncTransaction } from "@/types/api";

import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  type OutboxEntity,
  type OutboxOperation,
  PROFILE_KEY,
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
} from "./reproject";

const STORE_OF = {
  account: "accounts",
  category: "categories",
  transaction: "transactions",
  budget: "budgets",
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

// D-24: for every row the mirror keeps the server's version and, on top of it, what the queue will
// still send. Everything that learns something new about a row — a page of the feed, the answer to
// a write, the `current` of a 409, a discard, a retry — comes through here, so the row on screen,
// the version kept aside for the sheet and the money effects never drift apart. Without `server`
// the row's own baseline is used; with no operation left on the row the baseline is dropped, and
// the row is the server's again.
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
  const kept = mine.length > 0 ? baseline : undefined;

  if (entity === "account") {
    await tx.objectStore("accounts").put(accountRecord(row as Account, kept as Account));
  } else if (entity === "category") {
    await tx.objectStore("categories").put(categoryRecord(row as Category, kept as Category));
  } else if (entity === "budget") {
    await tx.objectStore("budgets").put(budgetRecord(row as SyncBudget, kept as SyncBudget));
  } else {
    await tx
      .objectStore("transactions")
      .put(transactionRecord(row as SyncTransaction, kept as SyncTransaction));
  }

  // The balance projection is the server's figure plus what the queue moved, so each effect has to
  // start from the server's row — the one the feed or the answer just brought, not the one the
  // mirror held when the write was queued. Only when the server has the row: a create still in the
  // queue keeps its own `before: null`.
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

// A removal the server confirmed without sending the row back (an archive answers `{ message }`,
// F-22; a delete that was already gone answers 404): the baseline moves the way the operation asked,
// because the server did do it and nothing else will say so until the next pull.
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
}
