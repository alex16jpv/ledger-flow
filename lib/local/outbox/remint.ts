import type { SyncBudget, SyncTransaction } from "@/types/api";

import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  type OutboxEntity,
  type OutboxOperation,
  transactionRecord,
} from "../schema";
import { type VaultDb, type WriteTransaction, writeTransaction } from "./queue";

// The id lives in the row, the rows naming it and the queue; all of them move together.
const REFERENCE_KEYS = ["fromAccountId", "toAccountId", "categoryId", "id"] as const;

// Returns the same object when nothing in it named the old id, so a caller can tell a rewrite apart.
function rewriteBody(body: unknown, oldId: string, newId: string): unknown {
  if (typeof body !== "object" || body === null) return body;
  const next = { ...(body as Record<string, unknown>) };
  let changed = false;
  for (const key of REFERENCE_KEYS) {
    if (next[key] !== oldId) continue;
    next[key] = newId;
    changed = true;
  }
  const categoryIds: unknown = next.categoryIds;
  if (Array.isArray(categoryIds) && categoryIds.includes(oldId)) {
    next.categoryIds = (categoryIds as unknown[]).map((value) => (value === oldId ? newId : value));
    changed = true;
  }
  return changed ? next : body;
}

// `projectBalances` keys an effect by account id, so the rows inside it move with the account.
function rewriteEffect(effect: unknown, oldId: string, newId: string): unknown {
  if (typeof effect !== "object" || effect === null) return effect;
  const { before, after } = effect as { before?: unknown; after?: unknown };
  const next = {
    before: rewriteBody(before, oldId, newId),
    after: rewriteBody(after, oldId, newId),
  };
  return next.before === before && next.after === after ? effect : next;
}

const moved = <T extends { id: string }>(server: T | undefined, newId: string): T | undefined =>
  server && { ...server, id: newId };

// F-57: a merge lands on a row the mirror already holds — the server's — and that one stays.
async function moveRow(
  tx: WriteTransaction,
  entity: OutboxEntity,
  oldId: string,
  newId: string,
): Promise<void> {
  if (entity === "account") {
    const store = tx.objectStore("accounts");
    const record = await store.get(oldId);
    if (!record) return;
    await store.delete(oldId);
    if (await store.get(newId)) return;
    await store.put(accountRecord({ ...record.row, id: newId }, moved(record.server, newId)));
    return;
  }
  if (entity === "category") {
    const store = tx.objectStore("categories");
    const record = await store.get(oldId);
    if (!record) return;
    await store.delete(oldId);
    if (await store.get(newId)) return;
    await store.put(categoryRecord({ ...record.row, id: newId }, moved(record.server, newId)));
    return;
  }
  if (entity === "budget") {
    const store = tx.objectStore("budgets");
    const record = await store.get(oldId);
    if (!record) return;
    await store.delete(oldId);
    if (await store.get(newId)) return;
    await store.put(budgetRecord({ ...record.row, id: newId }, moved(record.server, newId)));
    return;
  }
  const store = tx.objectStore("transactions");
  const record = await store.get(oldId);
  if (!record) return;
  await store.delete(oldId);
  if (await store.get(newId)) return;
  await store.put(transactionRecord({ ...record.row, id: newId }, moved(record.server, newId)));
}

const swapId = (id: string | null, oldId: string, newId: string): string | null =>
  id === oldId ? newId : id;

// D-24: the baseline kept aside names the same ids, or the next reconcile puts the old id back.
async function moveReferences(
  tx: WriteTransaction,
  entity: OutboxEntity,
  oldId: string,
  newId: string,
): Promise<void> {
  if (entity === "account") {
    const store = tx.objectStore("transactions");
    for (const record of await store.getAll()) {
      const { fromAccountId, toAccountId } = record.row;
      if (fromAccountId !== oldId && toAccountId !== oldId) continue;
      const accounts = (row: SyncTransaction): SyncTransaction => ({
        ...row,
        fromAccountId: swapId(row.fromAccountId, oldId, newId),
        toAccountId: swapId(row.toAccountId, oldId, newId),
      });
      await store.put(
        transactionRecord(accounts(record.row), record.server && accounts(record.server)),
      );
    }
    return;
  }
  if (entity !== "category") return;
  const transactions = tx.objectStore("transactions");
  for (const record of await transactions.getAll()) {
    if (record.row.categoryId !== oldId) continue;
    const category = (row: SyncTransaction): SyncTransaction => ({
      ...row,
      categoryId: swapId(row.categoryId, oldId, newId),
    });
    await transactions.put(
      transactionRecord(category(record.row), record.server && category(record.server)),
    );
  }
  const budgets = tx.objectStore("budgets");
  for (const record of await budgets.getAll()) {
    if (!record.row.categoryIds.includes(oldId)) continue;
    const categories = (row: SyncBudget): SyncBudget => ({
      ...row,
      categoryIds: row.categoryIds.map((id) => (id === oldId ? newId : id)),
    });
    await budgets.put(
      budgetRecord(categories(record.row), record.server && categories(record.server)),
    );
  }
}

// F-21 (O-B1 with D-17): `reminted` makes it once — a second collision on a v7 is a bug.
export async function remint(
  db: VaultDb,
  entity: OutboxEntity,
  oldId: string,
  newId: string,
): Promise<void> {
  const tx = writeTransaction(db);
  await moveRow(tx, entity, oldId, newId);
  await moveReferences(tx, entity, oldId, newId);

  const outbox = tx.objectStore("outbox");
  for (const operation of await outbox.getAll()) {
    const mine = operation.entity === entity && operation.entityId === oldId;
    const depends = operation.dependsOn.includes(oldId);
    const payload = operation.payload as { body?: unknown; effect?: unknown } | undefined;
    const body = rewriteBody(payload?.body, oldId, newId);
    const effect = rewriteEffect(payload?.effect, oldId, newId);
    if (!mine && !depends && body === payload?.body && effect === payload?.effect) continue;
    const next: OutboxOperation = {
      ...operation,
      ...(mine ? { entityId: newId, status: "pending", lastError: null, reminted: true } : {}),
      dependsOn: operation.dependsOn.map((id) => (id === oldId ? newId : id)),
      payload: {
        ...payload,
        ...(body === undefined ? {} : { body }),
        ...(effect === undefined ? {} : { effect }),
      },
    };
    await outbox.put(next);
  }
  await tx.done;
}
