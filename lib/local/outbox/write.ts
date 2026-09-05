import { ApiError, NetworkError } from "@/lib/api/errors";
import { connectivityStore } from "@/lib/network/connectivity";

import { currentVault } from "../repository/read";
import { isRemoval } from "./envelope";
import { NotProjectableError } from "./projected";
import {
  type LocalWrite,
  markOperation,
  queueWrite,
  settleWrite,
  type VaultDb,
  type WriteTransaction,
} from "./queue";
import { refreshOutboxStatus } from "./status";

// What the server needs to refuse a write made against a row it has already moved on from (O-B2).
// Absent for a create and for a row the queue has not put on the server yet: guarding against an
// `updatedAt` the server never printed would be a 409 on every attempt.
export interface WriteGuard {
  ifMatch?: string;
}

export interface WriteRequest<T> {
  local: LocalWrite;
  send: (guard: WriteGuard) => Promise<T>;
  // The server's row, written into the mirror in the same transaction that drops the operation.
  confirm: (tx: WriteTransaction, result: T) => Promise<void> | void;
  // What the screen gets while the write is still queued: the projection, read back from the mirror.
  optimistic: (db: VaultDb) => Promise<T> | T;
}

// A rejection the queue can outlive: the request never arrived, or the server could not answer it
// yet. Anything else in the 4xx range is the server saying no for good, and the write is undone.
function retryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (!(error instanceof ApiError)) return false;
  return (
    error.status >= 500 || error.status === 429 || error.status === 408 || error.status === 401
  );
}

const isConflict = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "STALE_UPDATE";

// O-B2: a transaction the server no longer has answers 404, and for a delete or an archive that is
// the state the operation asked for. Only a removal may read it that way.
const isAlreadyGone = (error: unknown, action: string): boolean =>
  error instanceof ApiError && error.status === 404 && isRemoval(action);

// The mirror image of `repository/read`: the entity and its operation land in one IndexedDB
// transaction, the screen is answered from that projection, and the server is asked afterwards.
// Part 1 sends once, inline; the engine (single flight, backoff, coalescing, retries) is part 2, so
// until then a queued operation waits for the next write and nothing here ever drops one.
export async function write<T>(request: WriteRequest<T>): Promise<T> {
  const vault = currentVault();
  if (!vault) return request.send({});
  const { db } = vault;

  let queued;
  try {
    queued = await queueWrite(db, request.local);
  } catch (error) {
    if (!(error instanceof NotProjectableError)) throw error;
    return request.send({});
  }
  await refreshOutboxStatus(db);
  const { seq } = queued.operation;

  const answerLocally = async (): Promise<T> => {
    await refreshOutboxStatus(db);
    return request.optimistic(db);
  };

  if (connectivityStore.getSnapshot() === "offline") return answerLocally();

  try {
    const result = await request.send({ ifMatch: queued.operation.baseUpdatedAt });
    await settleWrite(db, seq, (tx) => request.confirm(tx, result));
    await refreshOutboxStatus(db);
    return result;
  } catch (error) {
    if (isAlreadyGone(error, request.local.action)) {
      await settleWrite(db, seq);
      return answerLocally();
    }
    if (isConflict(error)) {
      // The user's edit is not lost and not applied to the server: O-F5a opens the resolution sheet
      // from here. Until then the queue holds it and the figures stay marked as a projection.
      await markOperation(db, seq, "conflict", (error as ApiError).code);
      return answerLocally();
    }
    if (retryable(error)) {
      await markOperation(db, seq, "pending", error instanceof ApiError ? error.code : "NETWORK");
      return answerLocally();
    }
    // Refused for good: the mirror goes back to what it was and the error reaches the form, which
    // is the only place that can still fix it.
    await settleWrite(db, seq, queued.undo);
    await refreshOutboxStatus(db);
    throw error;
  }
}
