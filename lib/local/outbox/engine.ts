import { ApiError, NetworkError } from "@/lib/api/errors";
import { connectivityStore } from "@/lib/network/connectivity";

import { currentVault } from "../repository/read";
import { type Cancelled, coalesce, type Collapsed } from "./coalesce";
import { conflictKind } from "./conflict";
import { isRemoval, newEntityId, operationPayload } from "./envelope";
import {
  markOperation,
  pendingOperations,
  rebaseGuards,
  settleWrite,
  type VaultDb,
  type WriteTransaction,
  writeTransaction,
} from "./queue";
import { reconcileRemoval, reconcileRow } from "./reconcile";
import { remint } from "./remint";
import { routeFor, serverBaseline } from "./routes";
import { outboxStatusStore, refreshOutboxStatus } from "./status";

// The plan's numbers (§6 O-F4). The step doubles from a second to a minute; the jitter can only
// shorten it, so a fleet of devices that lost the network together does not come back in lockstep.
export const BACKOFF_MIN_MS = 1_000;
export const BACKOFF_MAX_MS = 60_000;

// How many times a text-only edit may rebase itself onto a fresh stamp before it stops being bad
// luck and starts being a row somebody else is writing continuously. Then it asks, like the rest.
export const AUTO_MERGE_ATTEMPTS = 5;

// What the service worker of O-F6 will register and post back. Registering the tag is harmless
// where no worker handles it yet, and the listener is what turns a wake-up into a drain.
export const OUTBOX_SYNC_TAG = "ledger-flow-outbox";

export type DrainOutcome =
  | { kind: "sent"; result: unknown }
  | { kind: "gone" }
  | { kind: "cancelled" }
  | { kind: "absorbed"; into: number }
  | { kind: "queued"; code: string }
  | { kind: "conflict" }
  | { kind: "merged" }
  | { kind: "rejected"; error: unknown }
  | { kind: "held"; on: string }
  | { kind: "reminted"; entityId: string };

export type DrainReport = Map<number, DrainOutcome>;

export const EMPTY_REPORT: DrainReport = new Map();

// A rejection the queue can outlive: the request never arrived, or the server could not answer it
// yet. Anything else in the 4xx range is the server saying no for good, and the write is undone.
function retryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (!(error instanceof ApiError)) return false;
  return (
    error.status >= 500 || error.status === 429 || error.status === 408 || error.status === 401
  );
}

const codeOf = (error: unknown): string =>
  error instanceof ApiError ? (error.code ?? String(error.status)) : "NETWORK";

const isConflict = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "STALE_UPDATE";

// O-B2: a transaction the server no longer has answers 404, and for a delete or an archive that is
// the state the operation asked for. Only a removal may read it that way.
const isAlreadyGone = (error: unknown, action: string): boolean =>
  error instanceof ApiError && error.status === 404 && isRemoval(action);

// O-B1 with D-17: `ID_TAKEN` only ever means the id belongs to ANOTHER user, so the answer is a new
// id, not an error in the user's face (F-21).
const isIdTaken = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "ID_TAKEN";

// The `updatedAt` a successful write answers with, when it answers a row at all (an archive answers
// `{ message }` today, F-22).
const stampOf = (answer: unknown): string | undefined => {
  const updatedAt = (answer as { updatedAt?: unknown } | null)?.updatedAt;
  return typeof updatedAt === "string" ? updatedAt : undefined;
};

const isCreate = (action: string): boolean => action === "create" || action === "quickAdd";

// How a write undoes itself, kept by seq while the tab that made it is still open. The engine runs
// it when the server refuses the operation for good; an operation replayed after a reload has none,
// so it is left `failed` in the queue for the tray of O-F5a instead of silently disappearing.
const rollbacks = new Map<number, (tx: WriteTransaction) => Promise<void>>();

export function registerRollback(seq: number, undo: (tx: WriteTransaction) => Promise<void>): void {
  rollbacks.set(seq, undo);
}

function takeRollbacks(seqs: number[]): ((tx: WriteTransaction) => Promise<void>)[] {
  const taken = [];
  for (const seq of seqs) {
    const undo = rollbacks.get(seq);
    rollbacks.delete(seq);
    if (undo) taken.push(undo);
  }
  return taken;
}

const forget = (seqs: number[]): void => {
  for (const seq of seqs) rollbacks.delete(seq);
};

// Resolving a conflict settles operations the engine never sent: their rollbacks go with them.
export const forgetRollbacks = forget;

// Drops an operation and everything folded into it in one transaction, together with whatever the
// server's answer leaves in the mirror.
async function settle(
  db: VaultDb,
  entry: Collapsed,
  apply?: (tx: WriteTransaction) => Promise<void> | void,
): Promise<void> {
  forget([entry.operation.seq, ...entry.absorbed]);
  await settleWrite(db, entry.operation.seq, async (tx) => {
    for (const seq of entry.absorbed) await tx.objectStore("outbox").delete(seq);
    await apply?.(tx);
  });
}

// A movement created and deleted before either left the device: the operations go, and so does the
// row, because nothing on the server ever knew about it.
async function cancel(db: VaultDb, cancelled: Cancelled[], report: DrainReport): Promise<void> {
  const tx = writeTransaction(db);
  for (const entry of cancelled) {
    const undos = takeRollbacks([...entry.seqs].reverse());
    for (const seq of entry.seqs) {
      await tx.objectStore("outbox").delete(seq);
      report.set(seq, { kind: "cancelled" });
    }
    for (const undo of undos) await undo(tx);
    await tx.objectStore("transactions").delete(entry.entityId);
  }
  await tx.done;
}

// Marks the operation as being asked about without counting the attempt: `markOperation` does that
// once, when the answer is in. A tab killed mid-flight leaves `sending` behind, which the next pass
// picks up like any other queued operation — and which coalescing will not fold across.
async function beginSend(db: VaultDb, seq: number): Promise<void> {
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  const operation = await store.get(seq);
  if (operation) await store.put({ ...operation, status: "sending" });
  await tx.done;
}

interface PassResult {
  // Something left the queue, so another look may find more to do.
  progressed: boolean;
  // The network or the server asked us to come back later: the pass ends and the backoff starts.
  stopped: boolean;
  pushed: boolean;
  retryAfterMs: number;
}

async function sendPlanned(
  db: VaultDb,
  entries: Collapsed[],
  report: DrainReport,
): Promise<PassResult> {
  const result: PassResult = { progressed: false, stopped: false, pushed: false, retryAfterMs: 0 };
  // The ids nothing may be sent against: an operation in conflict or refused for good, and anything
  // that named it. Only its dependents are held; the rest of the queue keeps going.
  const blocked = new Set<string>();
  // The rows whose create is still ahead in this plan: nothing that names one may go first. With
  // `seq` alone this never happens; it is the belt for any fold that moves an operation earlier.
  const creating = new Set<string>();
  for (const entry of entries) {
    const { status, entityId, action } = entry.operation;
    if (status === "conflict" || status === "failed") blocked.add(entityId);
    else if (isCreate(action)) creating.add(entityId);
  }

  for (const entry of entries) {
    const operation = entry.operation;
    const { seq, entityId, entity, action } = operation;
    if (operation.status === "conflict" || operation.status === "failed") continue;

    const waitingOn = operation.dependsOn.find((id) => blocked.has(id) || creating.has(id));
    if (waitingOn !== undefined || blocked.has(entityId)) {
      blocked.add(entityId);
      report.set(seq, { kind: "held", on: waitingOn ?? entityId });
      continue;
    }
    for (const absorbed of entry.absorbed) report.set(absorbed, { kind: "absorbed", into: seq });

    creating.delete(entityId);
    await beginSend(db, seq);
    try {
      const answer = await routeFor(entity, action).send(
        { entityId, payload: operationPayload(operation) },
        { ifMatch: operation.baseUpdatedAt },
      );
      let rebased = 0;
      await settle(db, entry, async (tx) => {
        await routeFor(entity, action).confirm(tx, answer, operation);
        rebased = await rebaseGuards(tx, operation, stampOf(answer));
      });
      report.set(seq, { kind: "sent", result: answer });
      result.progressed = true;
      result.pushed = true;
      // The plan still holds the guards this answer just moved: the pass looks again.
      if (rebased > 0) return result;
    } catch (error) {
      if (isAlreadyGone(error, action)) {
        await settle(db, entry, (tx) => reconcileRemoval(tx, operation));
        report.set(seq, { kind: "gone" });
        result.progressed = true;
        result.pushed = true;
        continue;
      }
      if (isIdTaken(error) && !operation.reminted) {
        const minted = newEntityId();
        await remint(db, entity, entityId, minted);
        report.set(seq, { kind: "reminted", entityId: minted });
        result.progressed = true;
        // Everything after this in the snapshot may name the old id: the pass looks again.
        return result;
      }
      if (isConflict(error)) {
        const current = error instanceof ApiError ? error.current : undefined;
        const stamp = stampOf(current);
        // §6 O-F5a: an edit that only carries text merges by itself over the stamp the server
        // answered with — the API's PUT is a partial update, so the other device's other fields
        // survive. A stamp that did not move would only conflict again, so it is not retried.
        if (
          conflictKind(operation) === "text" &&
          stamp !== undefined &&
          stamp !== operation.baseUpdatedAt &&
          operation.attempts < AUTO_MERGE_ATTEMPTS
        ) {
          await markOperation(db, seq, "pending", "STALE_UPDATE", { baseUpdatedAt: stamp });
          report.set(seq, { kind: "merged" });
          result.progressed = true;
          // The plan holds the guard this operation just moved: the pass looks at the queue again.
          return result;
        }
        // Money or structure: the user's edit is neither lost nor applied, and the sheet is where
        // it is decided. The queue holds it, the figures stay marked, and only what named this row
        // waits with it. The server's own row rides along so the sheet needs no second request,
        // and the mirror shows it (D-23): the user's version lives in the sheet from here on.
        await markOperation(
          db,
          seq,
          "conflict",
          "STALE_UPDATE",
          current === undefined ? {} : { serverRow: current },
          async (tx) => {
            await reconcileRow(
              tx,
              entity,
              entityId,
              current === undefined ? undefined : await serverBaseline(tx, entity, current),
            );
          },
        );
        blocked.add(entityId);
        report.set(seq, { kind: "conflict" });
        continue;
      }
      if (retryable(error)) {
        await markOperation(db, seq, "pending", codeOf(error));
        report.set(seq, { kind: "queued", code: codeOf(error) });
        result.stopped = true;
        if (error instanceof ApiError && error.retryAfterSeconds) {
          result.retryAfterMs = error.retryAfterSeconds * 1_000;
        }
        // Nothing is reordered and nothing is dropped: the rest of the queue waits its turn.
        return result;
      }
      const undos = takeRollbacks([seq, ...entry.absorbed].reverse());
      if (undos.length < 1 + entry.absorbed.length) {
        // Nobody left to hand the error to — this operation, or one folded into it, outlived the tab
        // that made it. Undoing only half of a fold would leave the mirror at an edit the server never
        // got, with no operation behind it; the whole run stays in the queue as `failed` so the tray
        // of O-F5a can show it, rather than vanishing.
        await markOperation(db, seq, "failed", codeOf(error), {}, (tx) =>
          reconcileRow(tx, entity, entityId),
        );
        blocked.add(entityId);
        report.set(seq, { kind: "rejected", error });
        continue;
      }
      await settleWrite(db, seq, async (tx) => {
        for (const absorbed of entry.absorbed) await tx.objectStore("outbox").delete(absorbed);
        for (const undo of undos) await undo(tx);
      });
      report.set(seq, { kind: "rejected", error });
      result.progressed = true;
    }
  }
  return result;
}

// The one timer the engine owns: the backoff. There is no periodic pull and no periodic push, so a
// device that changes nothing makes no requests at all (§4.2).
export type Scheduler = (run: () => void, delayMs: number) => () => void;

const timeoutScheduler: Scheduler = (run, delayMs) => {
  const timer = setTimeout(run, delayMs);
  return () => {
    clearTimeout(timer);
  };
};

interface EngineState {
  inFlight: Promise<DrainReport> | null;
  wanted: number;
  served: number;
  failures: number;
  schedule: Scheduler;
  cancelRetry: (() => void) | null;
  afterPush: (() => Promise<void> | void) | null;
  random: () => number;
  stop: (() => void) | null;
}

const state: EngineState = {
  inFlight: null,
  wanted: 0,
  served: 0,
  failures: 0,
  schedule: timeoutScheduler,
  cancelRetry: null,
  afterPush: null,
  random: Math.random,
  stop: null,
};

export function backoffDelay(failures: number, random: () => number = Math.random): number {
  const step = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** Math.max(0, failures - 1));
  return Math.round(step / 2 + random() * (step / 2));
}

function clearRetry(): void {
  state.cancelRetry?.();
  state.cancelRetry = null;
}

function scheduleRetry(retryAfterMs: number): void {
  clearRetry();
  const delay = Math.max(backoffDelay(state.failures, state.random), retryAfterMs);
  state.cancelRetry = state.schedule(() => {
    state.cancelRetry = null;
    void requestSync();
  }, delay);
}

async function pass(db: VaultDb): Promise<DrainReport> {
  const report: DrainReport = new Map();
  let pushed = false;
  let retryAfterMs = 0;
  let backOff = false;

  for (;;) {
    // Everything the queue held at this point is accounted for: a write that lands afterwards makes
    // `wanted` run ahead of this, and `requestSync` asks for another pass rather than losing it.
    state.served = state.wanted;
    if (connectivityStore.getSnapshot() === "offline") break;
    const plan = coalesce(await pendingOperations(db));
    if (plan.cancelled.length > 0) {
      await cancel(db, plan.cancelled, report);
      await refreshOutboxStatus(db);
      continue;
    }
    if (plan.operations.length === 0) break;
    const outcome = await sendPlanned(db, plan.operations, report);
    await refreshOutboxStatus(db);
    pushed ||= outcome.pushed;
    if (outcome.stopped) {
      backOff = true;
      retryAfterMs = outcome.retryAfterMs;
      break;
    }
    if (!outcome.progressed) break;
  }

  // §4.2: a pull after every push, and never on a background timer.
  if (pushed && state.afterPush) await state.afterPush();
  if (backOff) {
    state.failures += 1;
    scheduleRetry(retryAfterMs);
  } else {
    state.failures = 0;
    clearRetry();
  }
  // Whatever the queue still holds is work for a wake-up the app may not be open for.
  if (outboxStatusStore.getSnapshot().pending > 0) void registerBackgroundSync();
  return report;
}

// Single flight: while one drain is running every other trigger joins it. A request that arrives
// after the running pass took its last look at the queue is not lost — it asks for a pass of its own
// once this one is done, which is what keeps a write queued mid-drain from waiting for a click.
export function requestSync(): Promise<DrainReport> {
  const vault = currentVault();
  if (!vault) return Promise.resolve(EMPTY_REPORT);
  state.wanted += 1;
  const mine = state.wanted;
  if (!state.inFlight) {
    clearRetry();
    state.inFlight = pass(vault.db).finally(() => {
      state.inFlight = null;
    });
  }
  return state.inFlight.then((report) => (mine > state.served ? requestSync() : report));
}

interface SyncRegistration {
  sync: { register: (tag: string) => Promise<void> };
}

async function registerBackgroundSync(): Promise<void> {
  if (typeof window === "undefined" || !("SyncManager" in window)) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!("sync" in registration)) return;
    await (registration as ServiceWorkerRegistration & SyncRegistration).sync.register(
      OUTBOX_SYNC_TAG,
    );
  } catch {
    // No worker, or the browser refused the tag: the ordinary triggers still drain the queue.
  }
}

export interface SyncEngineOptions {
  // The pull of §4.2, run after a push actually reached the server.
  afterPush?: () => Promise<void> | void;
  random?: () => number;
  schedule?: Scheduler;
}

// Wires the four triggers the plan asks for: back online, app open (the caller's first request),
// regaining focus, and Background Sync where it exists. There is no periodic timer — only the
// backoff, and only while the queue still holds something.
export function startSyncEngine(options: SyncEngineOptions = {}): () => void {
  state.stop?.();
  state.afterPush = options.afterPush ?? null;
  state.random = options.random ?? Math.random;
  state.schedule = options.schedule ?? timeoutScheduler;
  state.failures = 0;

  const wake = (): void => {
    void requestSync();
  };
  const onConnectivity = (): void => {
    if (connectivityStore.getSnapshot() !== "offline") wake();
  };
  const onVisible = (): void => {
    if (document.visibilityState === "visible") wake();
  };
  const onWorkerMessage = (event: MessageEvent<unknown>): void => {
    const data = event.data as { type?: string } | null;
    if (data?.type === OUTBOX_SYNC_TAG) wake();
  };

  const unsubscribe = connectivityStore.subscribe(onConnectivity);
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", onVisible);
  const worker = "serviceWorker" in navigator ? navigator.serviceWorker : null;
  worker?.addEventListener("message", onWorkerMessage);

  const stop = (): void => {
    unsubscribe();
    window.removeEventListener("focus", wake);
    document.removeEventListener("visibilitychange", onVisible);
    worker?.removeEventListener("message", onWorkerMessage);
    clearRetry();
    state.stop = null;
    state.afterPush = null;
    state.schedule = timeoutScheduler;
    state.failures = 0;
  };
  state.stop = stop;
  return stop;
}

// Test seam: the queue survives, the engine's in-memory bookkeeping does not.
export function resetSyncEngine(): void {
  state.stop?.();
  clearRetry();
  state.inFlight = null;
  state.wanted = 0;
  state.served = 0;
  state.failures = 0;
  state.afterPush = null;
  state.random = Math.random;
  state.schedule = timeoutScheduler;
  rollbacks.clear();
}
