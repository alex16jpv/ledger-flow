import { ApiError } from "@/lib/api/errors";
import { reportError } from "@/lib/observability/reporter";
import type { Restamp } from "@/types/api";

import { vaultReady } from "../repository/read";
import {
  type DrainOutcome,
  type DrainReport,
  forgetRollbacks,
  pullAfterDirectSend,
  registerRollback,
  requestSync,
} from "./engine";
import { NotProjectableError } from "./projected";
import {
  type LocalWrite,
  type QueuedWrite,
  type QueueOptions,
  queueWrite,
  type VaultDb,
  writeTransaction,
} from "./queue";
import { applyRestamps, splitRestamps } from "./restamp";
import { routeFor } from "./routes";
import { refreshOutboxStatus } from "./status";

export interface WriteRequest<T> {
  local: LocalWrite;
  // What the screen gets while the write is still queued: the projection, read back from the mirror.
  optimistic: (db: VaultDb) => Promise<T> | T;
}

// F-27: the write already landed, so a vault that fails here must not tell the form it did not.
async function restampVault(db: VaultDb, restamped: Restamp[]): Promise<boolean> {
  if (restamped.length === 0) return false;
  const tx = writeTransaction(db);
  try {
    const moved = await applyRestamps(tx, restamped);
    await tx.done;
    return moved.rows > 0;
  } catch (error) {
    tx.done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      // Already gone: the failure that brought us here aborted it.
    }
    reportError(error, "vault");
    return false;
  }
}

// What the request looks like on the wire lives once, in `routes.ts`, for the engine to replay.
async function sendDirect<T>(local: LocalWrite, db?: VaultDb): Promise<T> {
  const route = routeFor(local.entity, local.action);
  // No vault, or a row the mirror cannot project: the write goes out as it did before O-F4.
  const { row, restamped } = splitRestamps(
    await route.send({ entityId: local.entityId, payload: local.payload }, {}),
  );
  const rewrote = db !== undefined && (await restampVault(db, restamped));
  // It reached the server and left no trace in the mirror, which is what the screen reads (F-33).
  await pullAfterDirectSend(rewrote);
  return row as T;
}

// Follows a seq through the fold: an operation merged into an earlier one shares its fate.
function outcomeOf(report: DrainReport, seq: number): DrainOutcome | undefined {
  const seen = new Set<number>();
  let outcome = report.get(seq);
  while (outcome?.kind === "absorbed" && !seen.has(outcome.into)) {
    seen.add(outcome.into);
    outcome = report.get(outcome.into);
  }
  return outcome;
}

// F-58: asking for a drain here would send the resolution alone, in a batch of one.
export async function enqueue(
  db: VaultDb,
  local: LocalWrite,
  options: QueueOptions = {},
): Promise<QueuedWrite> {
  const queued = await queueWrite(db, local, undefined, options);
  await refreshOutboxStatus(db);
  return queued;
}

export async function write<T>(request: WriteRequest<T>): Promise<T> {
  const vault = await vaultReady();
  if (!vault) return sendDirect<T>(request.local);
  const { db } = vault;

  let queued: QueuedWrite;
  try {
    queued = await queueWrite(db, request.local);
  } catch (error) {
    if (!(error instanceof NotProjectableError)) throw error;
    return sendDirect<T>(request.local, db);
  }
  const { seq } = queued.operation;
  registerRollback(seq, queued.undo);
  await refreshOutboxStatus(db);

  const outcome = outcomeOf(await requestSync(), seq);
  // Refused for good: the engine put the mirror back, and the form is the only place left.
  if (outcome?.kind === "rejected") throw outcome.error;
  // The server answered in time, so the screen gets its row rather than the projection of it.
  if (outcome?.kind === "sent") return outcome.result as T;
  // F-23: nobody is waiting any more, so the undo stops being an answer to a form.
  forgetRollbacks([seq]);
  return request.optimistic(db);
}

// F-20: each row keeps its own operation, guard and outcome, so partial success is possible.
export async function writeAll<T>(requests: WriteRequest<T>[]): Promise<PromiseSettledResult<T>[]> {
  const vault = await vaultReady();
  if (!vault) return Promise.allSettled(requests.map((request) => sendDirect<T>(request.local)));
  const { db } = vault;

  const queued: (QueuedWrite | ApiError | null)[] = [];
  for (const request of requests) {
    try {
      const entry = await queueWrite(db, request.local);
      registerRollback(entry.operation.seq, entry.undo);
      queued.push(entry);
    } catch (error) {
      // The mirror refused it the way the server would: that row fails, and the others still go.
      if (error instanceof ApiError) {
        queued.push(error);
        continue;
      }
      if (!(error instanceof NotProjectableError)) throw error;
      queued.push(null);
    }
  }
  await refreshOutboxStatus(db);
  const report = await requestSync();

  return Promise.allSettled(
    requests.map(async (request, index) => {
      const entry = queued[index];
      if (entry instanceof ApiError) throw entry;
      if (!entry) return sendDirect<T>(request.local, db);
      const outcome = outcomeOf(report, entry.operation.seq);
      if (outcome?.kind === "rejected") throw outcome.error;
      if (outcome?.kind === "sent") return outcome.result as T;
      forgetRollbacks([entry.operation.seq]);
      return request.optimistic(db);
    }),
  );
}
