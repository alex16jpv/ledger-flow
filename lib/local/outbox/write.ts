import { currentVault } from "../repository/read";
import { type DrainOutcome, type DrainReport, registerRollback, requestSync } from "./engine";
import { NotProjectableError } from "./projected";
import { type LocalWrite, type QueuedWrite, queueWrite, type VaultDb } from "./queue";
import { routeFor } from "./routes";
import { refreshOutboxStatus } from "./status";

export interface WriteRequest<T> {
  local: LocalWrite;
  // What the screen gets while the write is still queued: the projection, read back from the mirror.
  optimistic: (db: VaultDb) => Promise<T> | T;
}

// The mirror image of `repository/read`: the entity and its operation land in one IndexedDB
// transaction, the screen is answered from that projection, and the engine is asked to drain. What
// the request looks like on the wire lives once, in `routes.ts`, because the engine has to be able
// to rebuild it from the envelope alone long after this call returned.
async function sendDirect<T>(local: LocalWrite): Promise<T> {
  const route = routeFor(local.entity, local.action);
  // No vault, or a row the mirror cannot project: the write goes out the way it did before O-F4, and
  // with no network it fails as it always did rather than inventing a row. The cast is the one the
  // route's own type already made — this path has no projection to answer from.
  return (await route.send({ entityId: local.entityId, payload: local.payload }, {})) as T;
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

export async function write<T>(request: WriteRequest<T>): Promise<T> {
  const vault = currentVault();
  if (!vault) return sendDirect<T>(request.local);
  const { db } = vault;

  let queued: QueuedWrite;
  try {
    queued = await queueWrite(db, request.local);
  } catch (error) {
    if (!(error instanceof NotProjectableError)) throw error;
    return sendDirect<T>(request.local);
  }
  const { seq } = queued.operation;
  registerRollback(seq, queued.undo);
  await refreshOutboxStatus(db);

  const outcome = outcomeOf(await requestSync(), seq);
  // Refused for good: the engine has already put the mirror back, and the error reaches the form,
  // which is the only place that can still fix it.
  if (outcome?.kind === "rejected") throw outcome.error;
  // The server answered in time, so the screen gets its row rather than the projection of it.
  if (outcome?.kind === "sent") return outcome.result as T;
  return request.optimistic(db);
}

// Queues several writes before asking the engine for a single drain, so a screen that saves N rows
// does not make N round trips of its own. Each row keeps its own operation, its own guard and its
// own outcome: that is what makes partial success per row possible (F-20).
export async function writeAll<T>(requests: WriteRequest<T>[]): Promise<PromiseSettledResult<T>[]> {
  const vault = currentVault();
  if (!vault) return Promise.allSettled(requests.map((request) => sendDirect<T>(request.local)));
  const { db } = vault;

  const queued: (QueuedWrite | null)[] = [];
  for (const request of requests) {
    try {
      const entry = await queueWrite(db, request.local);
      registerRollback(entry.operation.seq, entry.undo);
      queued.push(entry);
    } catch (error) {
      if (!(error instanceof NotProjectableError)) throw error;
      queued.push(null);
    }
  }
  await refreshOutboxStatus(db);
  const report = await requestSync();

  return Promise.allSettled(
    requests.map(async (request, index) => {
      const entry = queued[index];
      if (!entry) return sendDirect<T>(request.local);
      const outcome = outcomeOf(report, entry.operation.seq);
      if (outcome?.kind === "rejected") throw outcome.error;
      if (outcome?.kind === "sent") return outcome.result as T;
      return request.optimistic(db);
    }),
  );
}
