import type { OutboxEntity, OutboxOperation } from "../schema";
import { restoreAccountWrite } from "./accounts";
import { isFutureDate, isNameTaken, ownServerRow, serverStamp } from "./conflict";
import { forgetRollbacks, requestSync } from "./engine";
import { operationPayload } from "./envelope";
import { NotProjectableError } from "./projected";
import { pendingOperations, type VaultDb, type WriteTransaction, writeTransaction } from "./queue";
import { reconcileRow } from "./reconcile";
import { serverBaseline } from "./routes";
import { refreshOutboxStatus } from "./status";
import { enqueue } from "./write";

const isCreate = (action: string): boolean => action === "create" || action === "quickAdd";

// An operation another tab put back in line is no longer the user's to discard.
const stuck = (operation: OutboxOperation): boolean =>
  operation.status === "conflict" || operation.status === "failed";

const STORE_OF: Record<OutboxEntity, "accounts" | "categories" | "transactions" | "budgets"> = {
  account: "accounts",
  category: "categories",
  transaction: "transactions",
  budget: "budgets",
};

// D-24: the baseline kept aside is at least as fresh as the 409's `current`, which only backs it.
async function reconcileResolved(tx: WriteTransaction, operation: OutboxOperation): Promise<void> {
  const { entity, entityId } = operation;
  const serverRow = ownServerRow(operation);
  const record = await tx.objectStore(STORE_OF[entity]).get(entityId);
  const baseline =
    record?.server === undefined && serverRow !== undefined
      ? await serverBaseline(tx, entity, serverRow)
      : undefined;
  await reconcileRow(tx, entity, entityId, baseline);
}

// Only a create is named in a `dependsOn`, so only discarding one cascades, transitively.
function victimsOf(queue: OutboxOperation[], discarded: OutboxOperation[]): OutboxOperation[] {
  const seqs = new Set<number>(discarded.map((operation) => operation.seq));
  const orphaned = new Set<string>();
  for (const operation of discarded) {
    if (isCreate(operation.action)) orphaned.add(operation.entityId);
  }

  for (let grew = true; grew;) {
    grew = false;
    for (const operation of queue) {
      if (seqs.has(operation.seq)) continue;
      const orphan =
        orphaned.has(operation.entityId) || operation.dependsOn.some((id) => orphaned.has(id));
      if (!orphan) continue;
      seqs.add(operation.seq);
      if (isCreate(operation.action)) orphaned.add(operation.entityId);
      grew = true;
    }
  }
  return queue.filter((operation) => seqs.has(operation.seq));
}

const seedsOf = (queue: OutboxOperation[], seqs: readonly number[]): OutboxOperation[] =>
  queue.filter((operation) => seqs.includes(operation.seq) && stuck(operation));

export interface DiscardResult {
  // How many operations left the queue, the discarded one included.
  discarded: number;
}

// F-23: the server never received the write, so no pull would correct the projection.
export async function discardOperations(
  db: VaultDb,
  seqs: readonly number[],
): Promise<DiscardResult> {
  const queue = await pendingOperations(db);
  return discardSeeds(db, queue, seedsOf(queue, seqs));
}

// F-65: the server never refused these — this build simply cannot send them.
export async function discardBlockedOperations(
  db: VaultDb,
  seqs: readonly number[],
): Promise<DiscardResult> {
  const queue = await pendingOperations(db);
  return discardSeeds(
    db,
    queue,
    queue.filter((operation) => seqs.includes(operation.seq)),
  );
}

async function discardSeeds(
  db: VaultDb,
  queue: OutboxOperation[],
  seeds: OutboxOperation[],
): Promise<DiscardResult> {
  if (seeds.length === 0) return { discarded: 0 };
  const victims = victimsOf(queue, seeds);

  forgetRollbacks(victims.map((victim) => victim.seq));
  const tx = writeTransaction(db);
  for (const victim of victims) await tx.objectStore("outbox").delete(victim.seq);
  const reconciled = new Set<string>();
  for (const victim of victims) {
    // A create the server never saw leaves no row behind; every other row goes back.
    if (isCreate(victim.action)) {
      await tx.objectStore(STORE_OF[victim.entity]).delete(victim.entityId);
      continue;
    }
    const key = `${victim.entity}:${victim.entityId}`;
    if (reconciled.has(key)) continue;
    reconciled.add(key);
    await reconcileResolved(tx, victim);
  }
  await tx.done;
  await refreshOutboxStatus(db);
  return { discarded: victims.length };
}

export const discardOperation = (db: VaultDb, seq: number): Promise<DiscardResult> =>
  discardOperations(db, [seq]);

// The count is only knowable before anything is deleted.
export async function discardImpact(db: VaultDb, seqs: readonly number[]): Promise<number> {
  const queue = await pendingOperations(db);
  const seeds = seedsOf(queue, seqs);
  return seeds.length === 0 ? 0 : victimsOf(queue, seeds).length;
}

// Guarded by the 409's stamp, and `attempts` restarts so §6 O-F5a can fold it again.
export async function retryOperations(db: VaultDb, seqs: readonly number[]): Promise<void> {
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  for (const seq of seqs) {
    const operation = await store.get(seq);
    if (!operation || !stuck(operation)) continue;
    const stamp = serverStamp(operation);
    const next: OutboxOperation = {
      ...operation,
      status: "pending",
      attempts: 0,
      lastError: null,
      ...(stamp === undefined ? {} : { baseUpdatedAt: stamp }),
    };
    delete next.serverRow;
    await store.put(next);
    // Back in line means back on the row: the user's version shows again until the server answers.
    await reconcileResolved(tx, operation);
  }
  await tx.done;
  await refreshOutboxStatus(db);
  // D-22 only rebases what an answer from the server has just proved, so the rest keep theirs.
  await requestSync();
}

export const retryOperation = (db: VaultDb, seq: number): Promise<void> =>
  retryOperations(db, [seq]);

// F-58: the restore is an ordinary operation (D-32) with a `seq` below the movement's.
export async function restoreArchivedAccount(db: VaultDb, seq: number): Promise<boolean> {
  const operation = await db.get("outbox", seq);
  if (!operation || !stuck(operation)) return false;
  const accountId = operation.archivedId;
  if (accountId === undefined) return false;
  try {
    await enqueue(db, restoreAccountWrite(accountId), { before: seq });
  } catch (error) {
    // The mirror no longer holds the account, so there is no row to un-archive and nothing to send.
    if (error instanceof NotProjectableError) return false;
    throw error;
  }

  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  const queued = await store.get(seq);
  if (queued) {
    const next: OutboxOperation = {
      ...queued,
      status: "pending",
      attempts: 0,
      lastError: null,
      // D-30: naming the account makes the batch answer `blocked` if the restore does not land.
      dependsOn: [...new Set([...queued.dependsOn, accountId])],
    };
    delete next.archivedId;
    await store.put(next);
    await reconcileResolved(tx, queued);
  }
  await tx.done;
  await refreshOutboxStatus(db);
  await requestSync();
  return true;
}

// F-60: the same restore goes back in line with the name the restore route already takes.
export async function restoreWithName(db: VaultDb, seq: number, name: string): Promise<boolean> {
  const operation = await db.get("outbox", seq);
  if (!operation || !stuck(operation) || !isNameTaken(operation)) return false;

  const payload = operationPayload(operation);
  const body = typeof payload.body === "object" && payload.body !== null ? payload.body : {};
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  const next: OutboxOperation = {
    ...operation,
    payload: { ...payload, body: { ...body, name } },
    status: "pending",
    attempts: 0,
    lastError: null,
  };
  // The refused row is somebody else's, and dropping it leaves the name-taken state too.
  delete next.serverRow;
  await store.put(next);
  // Written first, so the row the mirror shows carries the new name from now on.
  await reconcileResolved(tx, next);
  await tx.done;
  await refreshOutboxStatus(db);
  await requestSync();
  return true;
}

// F-66: a creation the server never took exists only here, so the date is corrected in place.
export async function retryWithDate(db: VaultDb, seq: number, date: string): Promise<boolean> {
  const operation = await db.get("outbox", seq);
  if (!operation || !stuck(operation) || !isFutureDate(operation)) return false;

  const payload = operationPayload(operation);
  const body = typeof payload.body === "object" && payload.body !== null ? payload.body : {};
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  const next: OutboxOperation = {
    ...operation,
    payload: { ...payload, body: { ...body, date } },
    status: "pending",
    attempts: 0,
    lastError: null,
  };
  delete next.serverRow;
  await store.put(next);
  await reconcileResolved(tx, next);
  await tx.done;
  await refreshOutboxStatus(db);
  await requestSync();
  return true;
}

// F-23: the queue in `seq` order, only what the user has to act on; a refusal is as stuck.
export async function operationsNeedingAttention(db: VaultDb): Promise<OutboxOperation[]> {
  const queue = await pendingOperations(db);
  return queue.filter(
    (operation) => operation.status === "conflict" || operation.status === "failed",
  );
}
