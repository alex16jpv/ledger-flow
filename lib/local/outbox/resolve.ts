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

// Everything that cannot survive without the operation being thrown away. Only a create is named in
// a `dependsOn`, so only discarding one cascades: the row will never exist on the server, and an
// operation addressing it would ask about an id nobody has. Transitive, because a create discarded
// this way can itself be what another create's row depended on.
function victimsOf(queue: OutboxOperation[], discarded: OutboxOperation): OutboxOperation[] {
  const seqs = new Set<number>([discarded.seq]);
  const orphaned = new Set<string>();
  if (isCreate(discarded.action)) orphaned.add(discarded.entityId);

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

export interface DiscardResult {
  // How many operations left the queue, the discarded one included.
  discarded: number;
}

// The user chose the server's version. The operation is settled without ever being sent, and the
// mirror goes back to the row the 409 answered with — the projection it holds is this device's
// version, and nothing else would replace it: the server never received the write, so no pull
// corrects it (F-23).
export async function discardOperation(db: VaultDb, seq: number): Promise<DiscardResult> {
  const queue = await pendingOperations(db);
  const operation = queue.find((entry) => entry.seq === seq);
  if (!operation) return { discarded: 0 };
  const victims = victimsOf(queue, operation);

  forgetRollbacks(victims.map((victim) => victim.seq));
  const tx = writeTransaction(db);
  for (const victim of victims) {
    await tx.objectStore("outbox").delete(victim.seq);
    // A create the server never saw leaves no row behind; anything else keeps whatever the mirror
    // holds until the row the server answered with, or the next pull, replaces it.
    if (isCreate(victim.action))
      await tx.objectStore(STORE_OF[victim.entity]).delete(victim.entityId);
  }
  if (operation.serverRow !== undefined && !isCreate(operation.action)) {
    await PUT_ROW[operation.entity](tx, operation.serverRow);
  }
  await tx.done;
  await refreshOutboxStatus(db);
  return { discarded: victims.length };
}

// The user chose this device's version. The operation goes back in line guarded by the stamp the
// server answered the 409 with, so it applies on top of the row it lost to instead of losing again.
// `attempts` restarts because this is a new decision, not another try at the old one — and a zeroed
// count is what lets the text rule of §6 O-F5a fold it again.
export async function retryOperation(db: VaultDb, seq: number): Promise<void> {
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  const operation = await store.get(seq);
  if (operation) {
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
  // Operations queued behind this one on the same row keep their own guard: each is its own
  // decision, and D-22 only rebases what an answer from the server has just proved.
  await requestSync();
}

// What the tray of part 2 and the sheet both open on: the queue in `seq` order, only what the user
// has to act on (F-23 — a definitive refusal is as stuck as a conflict).
export async function operationsNeedingAttention(db: VaultDb): Promise<OutboxOperation[]> {
  const queue = await pendingOperations(db);
  return queue.filter(
    (operation) => operation.status === "conflict" || operation.status === "failed",
  );
}
