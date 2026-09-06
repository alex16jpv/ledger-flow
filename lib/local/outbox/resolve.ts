import type { OutboxEntity, OutboxOperation } from "../schema";
import { restoreAccountWrite } from "./accounts";
import { ownServerRow, serverStamp } from "./conflict";
import { forgetRollbacks, requestSync } from "./engine";
import { NotProjectableError } from "./projected";
import { pendingOperations, type VaultDb, type WriteTransaction, writeTransaction } from "./queue";
import { reconcileRow } from "./reconcile";
import { serverBaseline } from "./routes";
import { refreshOutboxStatus } from "./status";
import { enqueue } from "./write";

const isCreate = (action: string): boolean => action === "create" || action === "quickAdd";

// Only what the user was asked about can be resolved: an operation another tab has already put back
// in line between the question and the answer is no longer theirs to discard.
const stuck = (operation: OutboxOperation): boolean =>
  operation.status === "conflict" || operation.status === "failed";

const STORE_OF: Record<OutboxEntity, "accounts" | "categories" | "transactions" | "budgets"> = {
  account: "accounts",
  category: "categories",
  transaction: "transactions",
  budget: "budgets",
};

// The row goes back to the server's version plus what the queue will still send (D-24). The
// baseline the mirror kept aside is at least as fresh as the 409's `current` (the conflict put it
// there, and any pull since replaced it); `current` only serves a row that has none.
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

// Everything that cannot survive without the operations being thrown away. Only a create is named
// in a `dependsOn`, so only discarding one cascades: the row will never exist on the server, and an
// operation addressing it would ask about an id nobody has. Transitive, because a create discarded
// this way can itself be what another create's row depended on.
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

// The user chose the server's version. The operations are settled without ever being sent, and the
// mirror goes back to the rows the 409 answered with — the projection it holds is this device's
// version, and nothing else would replace it: the server never received the write, so no pull
// corrects it (F-23).
export async function discardOperations(
  db: VaultDb,
  seqs: readonly number[],
): Promise<DiscardResult> {
  const queue = await pendingOperations(db);
  const seeds = seedsOf(queue, seqs);
  if (seeds.length === 0) return { discarded: 0 };
  const victims = victimsOf(queue, seeds);

  forgetRollbacks(victims.map((victim) => victim.seq));
  const tx = writeTransaction(db);
  for (const victim of victims) await tx.objectStore("outbox").delete(victim.seq);
  const reconciled = new Set<string>();
  for (const victim of victims) {
    // A create the server never saw leaves no row behind; every other row goes back to the server's
    // version plus whatever the queue still holds for it.
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

// What the tray has to say before it asks: discarding a create takes its dependents with it, and
// the count is only knowable before anything is deleted.
export async function discardImpact(db: VaultDb, seqs: readonly number[]): Promise<number> {
  const queue = await pendingOperations(db);
  const seeds = seedsOf(queue, seqs);
  return seeds.length === 0 ? 0 : victimsOf(queue, seeds).length;
}

// The user chose this device's version. Each operation goes back in line guarded by the stamp the
// server answered its 409 with, so it applies on top of the row it lost to instead of losing again.
// `attempts` restarts because this is a new decision, not another try at the old one — and a zeroed
// count is what lets the text rule of §6 O-F5a fold it again.
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
  // Operations queued behind these on the same row keep their own guard: each is its own decision,
  // and D-22 only rebases what an answer from the server has just proved.
  await requestSync();
}

export const retryOperation = (db: VaultDb, seq: number): Promise<void> =>
  retryOperations(db, [seq]);

// The way out of a `conflict` `RESOURCE_ARCHIVED`: the account the movement names was archived
// online while this device had no network (F-58). The restore is an operation like any other — no
// endpoint of its own, no validation skipped (D-32) — and it has to reach the server ahead of the
// movement, in the same batch, which is what the `seq` below the movement's buys. Nothing is atomic
// and nothing needs to be: a restore that lands without the movement leaves the account restored,
// which is what the user asked for, and the movement in the tray.
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
      // Naming the account is what makes the batch answer `blocked` instead of the same
      // `RESOURCE_ARCHIVED` if the restore does not land: `POST /sync` blocks by entity id (D-30).
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

// What the tray of part 2 and the sheet both open on: the queue in `seq` order, only what the user
// has to act on (F-23 — a definitive refusal is as stuck as a conflict).
export async function operationsNeedingAttention(db: VaultDb): Promise<OutboxOperation[]> {
  const queue = await pendingOperations(db);
  return queue.filter(
    (operation) => operation.status === "conflict" || operation.status === "failed",
  );
}
