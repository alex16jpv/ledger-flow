import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  contactRecord,
  type MirrorRecord,
  type OutboxEntity,
  type OutboxOperation,
  settlementRecord,
  sharedExpenseRecord,
  sharedGroupRecord,
  transactionRecord,
} from "../schema";
import { type VaultDb, type WriteTransaction, writeTransaction } from "./queue";

// They point into a group somebody else shared, whose id can be the very one that was taken.
const FOREIGN_KEYS = new Set(["importedFromGroupId", "importedFromExpenseId"]);

// Returns the same value when nothing in it named the old id, so a caller can tell a rewrite apart.
function swap<T>(value: T, oldId: string, newId: string): T {
  if (value === oldId) return newId as T;
  if (Array.isArray(value)) {
    const next = value.map((item: unknown) => swap(item, oldId, newId));
    return next.some((item, index) => item !== value[index]) ? (next as T) : value;
  }
  if (typeof value !== "object" || value === null) return value;
  let next: Record<string, unknown> | undefined;
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (FOREIGN_KEYS.has(key)) continue;
    const swapped = swap(field, oldId, newId);
    if (swapped === field) continue;
    next = { ...(next ?? value), [key]: swapped };
  }
  return (next as T | undefined) ?? value;
}

interface Store<R> {
  get: (key: string) => Promise<R | undefined>;
  getAll: () => Promise<R[]>;
  put: (record: R) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
}

async function swapIn<T, R extends MirrorRecord<T>>(
  store: Store<R>,
  build: (row: T, server?: T) => R,
  oldId: string,
  newId: string,
): Promise<void> {
  for (const record of await store.getAll()) {
    const row = swap(record.row, oldId, newId);
    const server = swap(record.server, oldId, newId);
    if (row === record.row && server === record.server) continue;
    if (record.id !== oldId) {
      await store.put(build(row, server));
      continue;
    }
    await store.delete(oldId);
    // F-57: a merge lands on a row the mirror already holds — the server's — and that one stays.
    if (!(await store.get(newId))) await store.put(build(row, server));
  }
}

// D-24: the baseline kept aside names the same ids, or the next reconcile puts the old id back.
export async function swapMirror(
  tx: WriteTransaction,
  oldId: string,
  newId: string,
): Promise<void> {
  const swaps = {
    account: () => swapIn(tx.objectStore("accounts"), accountRecord, oldId, newId),
    category: () => swapIn(tx.objectStore("categories"), categoryRecord, oldId, newId),
    budget: () => swapIn(tx.objectStore("budgets"), budgetRecord, oldId, newId),
    transaction: () => swapIn(tx.objectStore("transactions"), transactionRecord, oldId, newId),
    contact: () => swapIn(tx.objectStore("contacts"), contactRecord, oldId, newId),
    sharedGroup: () => swapIn(tx.objectStore("sharedGroups"), sharedGroupRecord, oldId, newId),
    sharedExpense: () =>
      swapIn(tx.objectStore("sharedExpenses"), sharedExpenseRecord, oldId, newId),
    settlement: () => swapIn(tx.objectStore("settlements"), settlementRecord, oldId, newId),
  } satisfies Record<OutboxEntity, () => Promise<void>>;
  for (const run of Object.values(swaps)) await run();
}

// F-21 (O-B1 with D-17): `reminted` makes it once — a second collision on a v7 is a bug.
export async function remint(
  db: VaultDb,
  entity: OutboxEntity,
  oldId: string,
  newId: string,
): Promise<void> {
  const tx = writeTransaction(db);
  await swapMirror(tx, oldId, newId);

  const outbox = tx.objectStore("outbox");
  for (const operation of await outbox.getAll()) {
    const mine = operation.entity === entity && operation.entityId === oldId;
    const payload = swap(operation.payload, oldId, newId);
    const dependsOn = swap(operation.dependsOn, oldId, newId);
    if (!mine && payload === operation.payload && dependsOn === operation.dependsOn) continue;
    const next: OutboxOperation = {
      ...operation,
      ...(mine ? { entityId: newId, status: "pending", lastError: null, reminted: true } : {}),
      dependsOn,
      payload,
    };
    await outbox.put(next);
  }
  await tx.done;
}
