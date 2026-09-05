import type { OutboxEntity, OutboxOperation } from "../schema";
import { serverStamp } from "./conflict";
import { forgetRollbacks, requestSync } from "./engine";
import { pendingOperations, type VaultDb, writeTransaction } from "./queue";
import { PUT_ROW } from "./routes";
import { refreshOutboxStatus } from "./status";

const isCreate = (action: string): boolean => action === "create" || action === "quickAdd";

const STORE_OF: Record<OutboxEntity, "accounts" | "categories" | "transactions" | "budgets"> = {
  account: "accounts",
  category: "categories",
  transaction: "transactions",
  budget: "budgets",
};

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
  queue.filter((operation) => seqs.includes(operation.seq));

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
  for (const victim of victims) {
    await tx.objectStore("outbox").delete(victim.seq);
    // A create the server never saw leaves no row behind; anything else keeps whatever the mirror
    // holds until the row the server answered with, or the next pull, replaces it.
    if (isCreate(victim.action))
      await tx.objectStore(STORE_OF[victim.entity]).delete(victim.entityId);
  }
  for (const seed of seeds) {
    if (seed.serverRow !== undefined && !isCreate(seed.action)) {
      await PUT_ROW[seed.entity](tx, seed.serverRow);
    }
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
    if (!operation) continue;
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
  }
  await tx.done;
  await refreshOutboxStatus(db);
  // Operations queued behind these on the same row keep their own guard: each is its own decision,
  // and D-22 only rebases what an answer from the server has just proved.
  await requestSync();
}

export const retryOperation = (db: VaultDb, seq: number): Promise<void> =>
  retryOperations(db, [seq]);

// What the tray of part 2 and the sheet both open on: the queue in `seq` order, only what the user
// has to act on (F-23 — a definitive refusal is as stuck as a conflict).
export async function operationsNeedingAttention(db: VaultDb): Promise<OutboxOperation[]> {
  const queue = await pendingOperations(db);
  return queue.filter(
    (operation) => operation.status === "conflict" || operation.status === "failed",
  );
}
