import type { IDBPDatabase, IDBPTransaction } from "idb";

import { OUTBOX_VERSION } from "../db";
import {
  MIRROR_STORES,
  type OutboxEntity,
  type OutboxOperation,
  type VaultSchema,
} from "../schema";
import { envelope, type MoneyEffect, type OperationDraft } from "./envelope";

// Every write opens the same scope: the mirror, the queue and the counter. IndexedDB needs the
// stores named up front, and a write that could not reach one of them would be the phantom this
// whole item exists to prevent.
const WRITE_STORES = [...MIRROR_STORES, "outbox", "meta"] as const;

export type WriteTransaction = IDBPTransaction<
  VaultSchema,
  (typeof WRITE_STORES)[number][],
  "readwrite"
>;

export type VaultDb = IDBPDatabase<VaultSchema>;

export function writeTransaction(db: VaultDb): WriteTransaction {
  return db.transaction([...WRITE_STORES], "readwrite");
}

// The counter never restarts and never reuses a number, so the queue's order survives a reload, a
// second tab and a clock that jumps. It lives in `meta`, inside the same transaction as the
// operation it numbers.
async function allocateSeq(tx: WriteTransaction): Promise<number> {
  const meta = tx.objectStore("meta");
  const record = await meta.get("outboxSeq");
  const next = (typeof record?.value === "number" ? record.value : 0) + 1;
  await meta.put({ key: "outboxSeq", value: next });
  return next;
}

// A resolution has to travel ahead of the operation it unblocks, in the same batch (F-58), and the
// counter only goes up: the room is made between `before` and whatever precedes it, which is why
// this one is not an integer. Nothing local reads `seq` as anything but an order, and the wire sends
// the rank inside the batch instead (D-33).
async function insertSeq(tx: WriteTransaction, before: number): Promise<number> {
  const keys = await tx.objectStore("outbox").getAllKeys(IDBKeyRange.upperBound(before, true));
  const previous = keys.length > 0 ? (keys[keys.length - 1] ?? 0) : 0;
  return (previous + before) / 2;
}

export async function operationsFor(
  tx: WriteTransaction,
  entity: OutboxEntity,
  entityId: string,
): Promise<OutboxOperation[]> {
  return tx.objectStore("outbox").index("entity").getAll([entity, entityId]);
}

// True while the queue still holds the create that would put this row on the server. Two things
// hang on it: an `If-Match` guard against an `updatedAt` the server never printed would always be
// stale, and an operation naming a row the server has not seen has to declare it in `dependsOn`.
export async function unsent(
  tx: WriteTransaction,
  entity: OutboxEntity,
  entityId: string,
): Promise<boolean> {
  const queued = await operationsFor(tx, entity, entityId);
  return queued.some((operation) => operation.action === "create");
}

export interface EntityRef {
  entity: OutboxEntity;
  id: string | null | undefined;
}

// The ids the client already knows the server does not: a movement that spends from an account
// created offline declares that account, and the engine holds it back only if that create fails.
// An operation's own row is not in here — same-entity order is `seq`'s job, not a dependency.
export async function dependenciesOf(tx: WriteTransaction, refs: EntityRef[]): Promise<string[]> {
  const seen = new Set<string>();
  for (const ref of refs) {
    if (!ref.id || seen.has(ref.id)) continue;
    if (await unsent(tx, ref.entity, ref.id)) seen.add(ref.id);
  }
  return [...seen];
}

// What a mirror projection reports back to the write: the guard it can offer the server, the ids it
// waits on, and how to put the mirror back if the server rejects the write for good.
export interface LocalChange {
  baseUpdatedAt?: string;
  dependsOn: string[];
  // What the write moved, recorded while the mirror still holds the row it replaces.
  effect?: MoneyEffect;
  undo: (tx: WriteTransaction) => Promise<void>;
}

export interface LocalWrite {
  entity: OutboxEntity;
  entityId: string;
  action: string;
  payload: OperationDraft["payload"];
  // Runs inside the transaction that queues the operation. Whatever it writes to the mirror and the
  // operation itself commit together or not at all: half of this is a movement that never happened.
  project: (tx: WriteTransaction, occurredAt: string) => Promise<LocalChange>;
}

export interface QueuedWrite {
  operation: OutboxOperation;
  undo: (tx: WriteTransaction) => Promise<void>;
}

export interface QueueOptions {
  // Where in the queue the operation goes. Absent: at the end, with the next number of the counter.
  before?: number;
}

export async function queueWrite(
  db: VaultDb,
  write: LocalWrite,
  now: () => Date = () => new Date(),
  options: QueueOptions = {},
): Promise<QueuedWrite> {
  const occurredAt = now().toISOString();
  const tx = writeTransaction(db);
  try {
    const change = await write.project(tx, occurredAt);
    const seq =
      options.before === undefined ? await allocateSeq(tx) : await insertSeq(tx, options.before);
    const operation = envelope(
      {
        entity: write.entity,
        entityId: write.entityId,
        action: write.action,
        payload: {
          ...write.payload,
          ...(change.effect ? { effect: change.effect } : {}),
        },
        baseUpdatedAt: change.baseUpdatedAt,
        dependsOn: change.dependsOn,
      },
      seq,
      occurredAt,
      OUTBOX_VERSION,
    );
    await tx.objectStore("outbox").put(operation);
    await tx.done;
    return { operation, undo: change.undo };
  } catch (error) {
    // O-F1's rule, applied to a write: nothing is written unless all of it is. Without the abort an
    // open transaction commits on its own, and the mirror would keep a row with no operation.
    // `tx.done` rejects with the abort nobody is awaiting any more; the failure below is the real one.
    tx.done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      // Already gone: the failure that brought us here aborted it.
    }
    throw error;
  }
}

// Dropping an operation and reconciling the mirror is one transaction too: a queue that forgot an
// operation whose result never landed is the same phantom seen from the other side.
export async function settleWrite(
  db: VaultDb,
  seq: number,
  apply?: (tx: WriteTransaction) => Promise<void> | void,
): Promise<void> {
  const tx = writeTransaction(db);
  await tx.objectStore("outbox").delete(seq);
  if (apply) await apply(tx);
  await tx.done;
}

// Every operation queued on one row reads the guard the mirror held at the time, and the client never
// writes `updatedAt` (invariant 2), so a chain of them all carry the stamp the first one is about to
// replace. When it lands, whatever still shares its guard moves to the stamp the server answered
// with. A different guard means a pull brought another device's edit: that one keeps it and earns
// its 409. Runs inside the transaction that settles the landed operation.
export async function rebaseGuards(
  tx: WriteTransaction,
  landed: OutboxOperation,
  stamp: string | undefined,
): Promise<number> {
  if (stamp === undefined) return 0;
  const store = tx.objectStore("outbox");
  let moved = 0;
  for (const queued of await operationsFor(tx, landed.entity, landed.entityId)) {
    if (queued.baseUpdatedAt !== landed.baseUpdatedAt || queued.baseUpdatedAt === stamp) continue;
    await store.put({ ...queued, baseUpdatedAt: stamp });
    moved += 1;
  }
  return moved;
}

export async function markOperation(
  db: VaultDb,
  seq: number,
  status: OutboxOperation["status"],
  lastError: string | null,
  extra: Partial<OutboxOperation> = {},
  apply?: (tx: WriteTransaction) => Promise<void> | void,
): Promise<void> {
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  const operation = await store.get(seq);
  if (operation) {
    await store.put({
      ...operation,
      status,
      lastError,
      attempts: operation.attempts + 1,
      ...extra,
    });
    await apply?.(tx);
  }
  await tx.done;
}

// The batch answered for every operation at once, so the queue moves for all of them at once too.
// `attempts` counts an operation the server was asked about: a request that never came back may
// have landed, which is what stops the fold of `coalesce` from crossing it.
export async function requeueOperations(
  db: VaultDb,
  seqs: readonly number[],
  lastError: string | null,
): Promise<void> {
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  for (const seq of seqs) {
    const operation = await store.get(seq);
    if (!operation) continue;
    await store.put({
      ...operation,
      status: "pending",
      lastError,
      attempts: operation.attempts + 1,
    });
  }
  await tx.done;
}

// `blocked`: the server did not attempt it, so nothing about it changed but the fact that it is
// back in line. Counting an attempt here would stop it from ever being folded again for a batch it
// was never part of.
export async function holdOperations(db: VaultDb, seqs: readonly number[]): Promise<void> {
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  for (const seq of seqs) {
    const operation = await store.get(seq);
    if (operation?.status !== "sending") continue;
    await store.put({ ...operation, status: "pending" });
  }
  await tx.done;
}

export async function pendingOperations(db: VaultDb): Promise<OutboxOperation[]> {
  const operations = await db.getAll("outbox");
  return operations.sort((left, right) => left.seq - right.seq);
}
