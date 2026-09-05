import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  type OutboxEntity,
  type OutboxOperation,
  transactionRecord,
} from "../schema";
import { type VaultDb, type WriteTransaction, writeTransaction } from "./queue";

// The id lives in three places: the row in the mirror, the rows that name it, and the operations
// still queued — as their own `entityId`, in their `dependsOn`, and inside the body they will
// replay. All of them move together or the queue starts pointing at a row that is not there.
const REFERENCE_KEYS = ["fromAccountId", "toAccountId", "categoryId", "id"] as const;

function rewriteBody(body: unknown, oldId: string, newId: string): unknown {
  if (typeof body !== "object" || body === null) return body;
  const next = { ...(body as Record<string, unknown>) };
  for (const key of REFERENCE_KEYS) {
    if (next[key] === oldId) next[key] = newId;
  }
  const categoryIds: unknown = next.categoryIds;
  if (Array.isArray(categoryIds)) {
    next.categoryIds = (categoryIds as unknown[]).map((value) => (value === oldId ? newId : value));
  }
  return next;
}

async function moveRow(
  tx: WriteTransaction,
  entity: OutboxEntity,
  oldId: string,
  newId: string,
): Promise<void> {
  if (entity === "account") {
    const record = await tx.objectStore("accounts").get(oldId);
    if (!record) return;
    await tx.objectStore("accounts").delete(oldId);
    await tx.objectStore("accounts").put(accountRecord({ ...record.row, id: newId }));
    return;
  }
  if (entity === "category") {
    const record = await tx.objectStore("categories").get(oldId);
    if (!record) return;
    await tx.objectStore("categories").delete(oldId);
    await tx.objectStore("categories").put(categoryRecord({ ...record.row, id: newId }));
    return;
  }
  if (entity === "budget") {
    const record = await tx.objectStore("budgets").get(oldId);
    if (!record) return;
    await tx.objectStore("budgets").delete(oldId);
    await tx.objectStore("budgets").put(budgetRecord({ ...record.row, id: newId }));
    return;
  }
  const record = await tx.objectStore("transactions").get(oldId);
  if (!record) return;
  await tx.objectStore("transactions").delete(oldId);
  await tx.objectStore("transactions").put(transactionRecord({ ...record.row, id: newId }));
}

async function moveReferences(
  tx: WriteTransaction,
  entity: OutboxEntity,
  oldId: string,
  newId: string,
): Promise<void> {
  if (entity === "account") {
    for (const record of await tx.objectStore("transactions").getAll()) {
      const { fromAccountId, toAccountId } = record.row;
      if (fromAccountId !== oldId && toAccountId !== oldId) continue;
      await tx.objectStore("transactions").put(
        transactionRecord({
          ...record.row,
          fromAccountId: fromAccountId === oldId ? newId : fromAccountId,
          toAccountId: toAccountId === oldId ? newId : toAccountId,
        }),
      );
    }
    return;
  }
  if (entity !== "category") return;
  for (const record of await tx.objectStore("transactions").getAll()) {
    if (record.row.categoryId !== oldId) continue;
    await tx
      .objectStore("transactions")
      .put(transactionRecord({ ...record.row, categoryId: newId }));
  }
  for (const record of await tx.objectStore("budgets").getAll()) {
    if (!record.row.categoryIds.includes(oldId)) continue;
    await tx.objectStore("budgets").put(
      budgetRecord({
        ...record.row,
        categoryIds: record.row.categoryIds.map((id) => (id === oldId ? newId : id)),
      }),
    );
  }
}

// F-21, the answer to `409 ID_TAKEN`: the id belongs to another user (O-B1 with D-17), so the row
// takes a new one and goes back in the queue. `reminted` makes it once and only once — a second
// collision on a freshly minted UUID v7 is not a coincidence to keep retrying, it is a bug.
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
    const payload = operation.payload as { body?: unknown } | undefined;
    const body = rewriteBody(payload?.body, oldId, newId);
    if (!mine && !depends && body === payload?.body) continue;
    const next: OutboxOperation = {
      ...operation,
      ...(mine ? { entityId: newId, status: "pending", lastError: null, reminted: true } : {}),
      dependsOn: operation.dependsOn.map((id) => (id === oldId ? newId : id)),
      payload: { ...payload, ...(body === undefined ? {} : { body }) },
    };
    await outbox.put(next);
  }
  await tx.done;
}
