import type { IDBPDatabase, IDBPTransaction } from "idb";

import { OUTBOX_VERSION } from "../db";
import {
  MIRROR_STORES,
  type OutboxEntity,
  type OutboxOperation,
  type VaultSchema,
} from "../schema";
import { envelope, type MoneyEffect, type OperationDraft } from "./envelope";

// IndexedDB needs the stores named up front, and every write opens all three together.
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

// The counter never restarts nor reuses a number, and lives in `meta` inside the same tx.
async function allocateSeq(tx: WriteTransaction): Promise<number> {
  const meta = tx.objectStore("meta");
  const record = await meta.get("outboxSeq");
  const next = (typeof record?.value === "number" ? record.value : 0) + 1;
  await meta.put({ key: "outboxSeq", value: next });
  return next;
}

// F-58: room is made below `before`, so this seq is fractional; the wire sends the rank (D-33).
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

// A guard on an `updatedAt` the server never printed is always stale; the row needs `dependsOn`.
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

// An operation's own row is not in here — same-entity order is `seq`'s job, not a dependency.
export async function dependenciesOf(tx: WriteTransaction, refs: EntityRef[]): Promise<string[]> {
  const seen = new Set<string>();
  for (const ref of refs) {
    if (!ref.id || seen.has(ref.id)) continue;
    if (await unsent(tx, ref.entity, ref.id)) seen.add(ref.id);
  }
  return [...seen];
}

// The guard it can offer, the ids it waits on, and how to put the mirror back on a refusal.
export interface LocalChange {
  baseUpdatedAt?: string;
  dependsOn: string[];
  // What the write moved, recorded while the mirror still holds the row it replaces.
  effect?: MoneyEffect;
  // The shared expense a movement in a group carries, which the server writes in the same request.
  sharedExpenseId?: string;
  undo: (tx: WriteTransaction) => Promise<void>;
}

export interface LocalWrite {
  entity: OutboxEntity;
  entityId: string;
  action: string;
  payload: OperationDraft["payload"];
  // Runs inside the transaction that queues the operation: both commit or neither does.
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
          ...(change.sharedExpenseId ? { sharedExpenseId: change.sharedExpenseId } : {}),
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
    // O-F1: without the abort the transaction commits and the mirror keeps a row with no operation.
    tx.done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      // Already gone: the failure that brought us here aborted it.
    }
    throw error;
  }
}

// Dropping the operation and reconciling the mirror is one transaction too.
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

// Invariant 2: whatever still shares the landed guard moves to the stamp the server answered.
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

// `attempts` counts an operation the server was asked about, which is what stops `coalesce`.
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

// `blocked` was never attempted, so counting one would stop it from ever being folded again.
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
