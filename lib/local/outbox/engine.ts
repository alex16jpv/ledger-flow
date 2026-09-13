import { ApiError, isErrorCode, NetworkError } from "@/lib/api/errors";
import { readSessionMarker } from "@/lib/auth/marker";
import { connectivityStore } from "@/lib/network/connectivity";
import { reportError } from "@/lib/observability/reporter";
import type { Account, SyncBatchResponse } from "@/types/api";

import { rememberServerTime } from "../clock";
import { currentVault } from "../repository/read";
import type { OutboxOperation } from "../schema";
import { batchBody, chunkBatch, postBatch } from "./batch";
import { type Cancelled, coalesce, type Collapsed } from "./coalesce";
import { conflictKind } from "./conflict";
import { isRemoval, newEntityId, operationPayload } from "./envelope";
import { recordNotices, type SyncNotice } from "./notices";
import {
  holdOperations,
  markOperation,
  pendingOperations,
  rebaseGuards,
  requeueOperations,
  settleWrite,
  type VaultDb,
  type WriteTransaction,
  writeTransaction,
} from "./queue";
import { reconcileRemoval, reconcileRow } from "./reconcile";
import { remint } from "./remint";
import { routeFor, serverBaseline } from "./routes";
import { outboxStatusStore, refreshOutboxStatus } from "./status";
import { reportSynced, resetSynced } from "./synced";
import { OUTBOX_SYNC_TAG } from "./tag";

// §6 O-F4: the jitter can only shorten the step, so devices do not come back in lockstep.
export const BACKOFF_MIN_MS = 1_000;
export const BACKOFF_MAX_MS = 60_000;

// Past this a text-only rebase is a row somebody else is writing continuously, so it asks.
export const AUTO_MERGE_ATTEMPTS = 5;

export type DrainOutcome =
  | { kind: "sent"; result: unknown }
  // It landed with no row back: a duplicate `opId` answered from memory, and the pull brings it.
  | { kind: "landed" }
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

// Anything else in the 4xx range is the server saying no for good, and the write is undone.
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

// O-B2: a 404 is the state a delete or an archive asked for; only a removal may read it so.
const isAlreadyGone = (error: unknown, action: string): boolean =>
  error instanceof ApiError && error.status === 404 && isRemoval(action);

// O-B1 with D-17: `ID_TAKEN` means the id belongs to another user, so the answer is a new id.
const isIdTaken = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "ID_TAKEN";

// F-26: the refresh already had its turn in `lib/api`, so a 401 here is a dead session.
const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;

// One answer settles it for the session and the queue leaves by the ordinary routes (2026-09-06).
const isBatchMissing = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 404 || error.status === 501);

// The envelope was refused, so nothing was applied: the plan goes out one request at a time.
const isEnvelopeRefused = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 400 || error.status === 413);

// The `updatedAt` a successful write answers with, when it answers a row at all.
const stampOf = (answer: unknown): string | undefined => {
  const updatedAt = (answer as { updatedAt?: unknown } | null)?.updatedAt;
  return typeof updatedAt === "string" ? updatedAt : undefined;
};

const isCreate = (action: string): boolean => action === "create" || action === "quickAdd";

// An operation replayed after a reload has no undo, so it is left `failed` for the tray (O-F5a).
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

// An undo still registered means a form is on screen waiting for this very pass.
const awaited = (seq: number): boolean => rollbacks.has(seq);

// Drops an operation and everything folded into it in one transaction.
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

// The row goes too: nothing on the server ever knew about it.
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

// Without counting the attempt: `markOperation` does that once, when the answer is in.
async function beginSending(db: VaultDb, seqs: readonly number[]): Promise<void> {
  const tx = writeTransaction(db);
  const store = tx.objectStore("outbox");
  for (const seq of seqs) {
    const operation = await store.get(seq);
    if (operation) await store.put({ ...operation, status: "sending" });
  }
  await tx.done;
}

interface PassResult {
  // Something left the queue, so another look may find more to do.
  progressed: boolean;
  // The network or the server asked us to come back later: the pass ends and the backoff starts.
  stopped: boolean;
  // F-32: the server said something about the data, so the round ends with a pull.
  answered: boolean;
  // The session died under the queue: the pass stops and nothing is scheduled (F-26).
  unauthorized: boolean;
  retryAfterMs: number;
}

const emptyPass = (): PassResult => ({
  progressed: false,
  stopped: false,
  answered: false,
  unauthorized: false,
  retryAfterMs: 0,
});

interface Holds {
  // Only the dependents of a blocked id are held; the rest of the queue keeps going.
  blocked: Set<string>;
  // The belt for any fold that moves an operation earlier; with `seq` alone it cannot happen.
  creating: Set<string>;
}

function initialHolds(entries: Collapsed[]): Holds {
  const holds: Holds = { blocked: new Set(), creating: new Set() };
  for (const entry of entries) {
    const { status, entityId, action } = entry.operation;
    if (status === "conflict" || status === "failed") holds.blocked.add(entityId);
    else if (isCreate(action)) holds.creating.add(entityId);
  }
  return holds;
}

// The id this operation has to wait for, if any.
function heldOn(operation: OutboxOperation, holds: Holds): string | undefined {
  const waitingOn = operation.dependsOn.find(
    (id) => holds.blocked.has(id) || holds.creating.has(id),
  );
  if (waitingOn !== undefined) return waitingOn;
  return holds.blocked.has(operation.entityId) ? operation.entityId : undefined;
}

async function sendPlanned(
  db: VaultDb,
  entries: Collapsed[],
  report: DrainReport,
): Promise<PassResult> {
  const result = emptyPass();
  const holds = initialHolds(entries);
  const { blocked, creating } = holds;

  for (const entry of entries) {
    const operation = entry.operation;
    const { seq, entityId, entity, action } = operation;
    if (operation.status === "conflict" || operation.status === "failed") continue;

    const waitingOn = heldOn(operation, holds);
    if (waitingOn !== undefined) {
      blocked.add(entityId);
      report.set(seq, { kind: "held", on: waitingOn });
      continue;
    }
    for (const absorbed of entry.absorbed) report.set(absorbed, { kind: "absorbed", into: seq });

    creating.delete(entityId);
    await beginSending(db, [seq]);
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
      result.answered = true;
      // The plan still holds the guards this answer just moved: the pass looks again.
      if (rebased > 0) return result;
    } catch (error) {
      if (isAlreadyGone(error, action)) {
        await settle(db, entry, (tx) => reconcileRemoval(tx, operation));
        report.set(seq, { kind: "gone" });
        result.progressed = true;
        result.answered = true;
        continue;
      }
      if (isIdTaken(error) && !operation.reminted) {
        const minted = newEntityId();
        await remint(db, entity, entityId, minted);
        report.set(seq, { kind: "reminted", entityId: minted });
        result.progressed = true;
        result.answered = true;
        // Everything after this in the snapshot may name the old id: the pass looks again.
        return result;
      }
      if (isConflict(error)) {
        const current = error instanceof ApiError ? error.current : undefined;
        const stamp = stampOf(current);
        // §6 O-F5a: the API's PUT is partial, so the other device's other fields survive the retry.
        if (
          conflictKind(operation) === "text" &&
          stamp !== undefined &&
          stamp !== operation.baseUpdatedAt &&
          operation.attempts < AUTO_MERGE_ATTEMPTS
        ) {
          await markOperation(db, seq, "pending", "STALE_UPDATE", { baseUpdatedAt: stamp });
          report.set(seq, { kind: "merged" });
          result.progressed = true;
          result.answered = true;
          // The plan holds the guard this operation just moved: the pass looks at the queue again.
          return result;
        }
        // D-23: the server's row rides along so the sheet needs no second request.
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
        result.answered = true;
        continue;
      }
      if (retryable(error)) {
        await markOperation(db, seq, "pending", codeOf(error));
        report.set(seq, { kind: "queued", code: codeOf(error) });
        result.stopped = true;
        result.unauthorized = isUnauthorized(error);
        if (error instanceof ApiError && error.retryAfterSeconds) {
          result.retryAfterMs = error.retryAfterSeconds * 1_000;
        }
        // Nothing is reordered and nothing is dropped: the rest of the queue waits its turn.
        return result;
      }
      const undos = takeRollbacks([seq, ...entry.absorbed].reverse());
      if (undos.length < 1 + entry.absorbed.length) {
        // O-F5a: undoing half a fold would strand the mirror, so the run stays `failed`.
        await markOperation(db, seq, "failed", codeOf(error), {}, (tx) =>
          reconcileRow(tx, entity, entityId),
        );
        blocked.add(entityId);
        report.set(seq, { kind: "rejected", error });
        result.answered = true;
        continue;
      }
      await settleWrite(db, seq, async (tx) => {
        for (const absorbed of entry.absorbed) await tx.objectStore("outbox").delete(absorbed);
        for (const undo of undos) await undo(tx);
      });
      report.set(seq, { kind: "rejected", error });
      result.progressed = true;
      result.answered = true;
    }
  }
  return result;
}

type BatchAnswer = SyncBatchResponse["results"][number];

interface BatchRun {
  db: VaultDb;
  report: DrainReport;
  result: PassResult;
  holds: Holds;
  // Whatever is left of the plan describes a queue that no longer exists, so the pass re-looks.
  stale: boolean;
}

// The refusal as the route would have raised it; `requestId` names the batch, not an operation.
const rejection = (answer: BatchAnswer): ApiError =>
  new ApiError({
    status: answer.status === "conflict" ? 409 : answer.code === "NOT_FOUND" ? 404 : 400,
    code: isErrorCode(answer.code) ? answer.code : null,
    message: answer.message ?? "The server refused this change",
    details: answer.details,
    requestId: "sync",
    current: answer.current,
  });

// With a row, the route's own `confirm`; without one the baseline moves as the operation asked.
async function confirmLanded(
  tx: WriteTransaction,
  operation: OutboxOperation,
  row: unknown,
): Promise<void> {
  if (row !== undefined) {
    await routeFor(operation.entity, operation.action).confirm(tx, row, operation);
    return;
  }
  if (isRemoval(operation.action)) {
    await reconcileRemoval(tx, operation);
    return;
  }
  await reconcileRow(tx, operation.entity, operation.entityId);
}

// The form is told what the route would have told it: the name is taken, which it can act on.
const nameTaken = (answer: BatchAnswer): ApiError =>
  new ApiError({
    status: 409,
    code: "DUPLICATE",
    message: "The server already had a row with this name",
    requestId: "sync",
    current: answer.result,
  });

async function applyLanded(run: BatchRun, entry: Collapsed, answer: BatchAnswer): Promise<void> {
  const { db, report } = run;
  let operation = entry.operation;
  const waiting = awaited(operation.seq);
  // F-57: the re-mint moves the id everywhere this device wrote it; no pull would fix it later.
  if (answer.mergedInto !== undefined && answer.mergedInto !== operation.entityId) {
    await remint(db, operation.entity, operation.entityId, answer.mergedInto);
    operation = { ...operation, entityId: answer.mergedInto };
    run.stale = true;
  }
  const notices: SyncNotice[] = (answer.warnings ?? []).map((code) => ({
    code,
    id: operation.entityId,
    at: answer.result?.updatedAt ?? operation.occurredAt,
  }));
  let rebased = 0;
  const landed = operation;
  await settle(db, { ...entry, operation: landed }, async (tx) => {
    await confirmLanded(tx, landed, answer.result);
    rebased = await rebaseGuards(tx, landed, stampOf(answer.result));
    await recordNotices(tx, notices);
  });
  report.set(
    landed.seq,
    answer.status === "merged" && waiting
      ? { kind: "rejected", error: nameTaken(answer) }
      : answer.result !== undefined
        ? { kind: "sent", result: answer.result }
        : isRemoval(landed.action)
          ? { kind: "gone" }
          : { kind: "landed" },
  );
  run.result.progressed = true;
  if (rebased > 0) run.stale = true;
}

async function applyConflict(run: BatchRun, entry: Collapsed, answer: BatchAnswer): Promise<void> {
  const { db, report } = run;
  const operation = entry.operation;
  const { seq, entity, entityId } = operation;
  // The OpenAPI cannot say required-for-this-status, so a missing code is not guessed.
  const { code, current } = answer;

  // O-B1 with D-17: the id belongs to another user, so the row takes a new one (F-21).
  if (code === "ID_TAKEN" && !operation.reminted) {
    const minted = newEntityId();
    await remint(db, entity, entityId, minted);
    report.set(seq, { kind: "reminted", entityId: minted });
    run.result.progressed = true;
    run.stale = true;
    return;
  }
  const stamp = stampOf(current);
  // §6 O-F5a: a stamp that did not move would only conflict again, so it is not retried.
  if (
    code === "STALE_UPDATE" &&
    conflictKind(operation) === "text" &&
    stamp !== undefined &&
    stamp !== operation.baseUpdatedAt &&
    operation.attempts < AUTO_MERGE_ATTEMPTS
  ) {
    await markOperation(db, seq, "pending", code, { baseUpdatedAt: stamp });
    report.set(seq, { kind: "merged" });
    run.result.progressed = true;
    run.stale = true;
    return;
  }
  // A taken name is fixed by typing another one, not in a tray the user never opened.
  if (code !== "STALE_UPDATE" && awaited(seq)) {
    await applyRejected(run, entry, answer);
    return;
  }
  // F-58: `RESOURCE_ARCHIVED` answers with the archived account, not this operation's row.
  const archived = code === "RESOURCE_ARCHIVED" ? (current as Account | undefined) : undefined;
  const own = archived === undefined && (current as { id?: string } | undefined)?.id === entityId;
  await markOperation(
    db,
    seq,
    "conflict",
    code ?? answer.status,
    archived !== undefined
      ? { archivedId: archived.id }
      : current === undefined
        ? {}
        : { serverRow: current },
    async (tx) => {
      if (archived !== undefined) await reconcileRow(tx, "account", archived.id, archived);
      await reconcileRow(
        tx,
        entity,
        entityId,
        own ? await serverBaseline(tx, entity, current) : undefined,
      );
    },
  );
  run.holds.blocked.add(entityId);
  report.set(seq, { kind: "conflict" });
}

async function applyRejected(run: BatchRun, entry: Collapsed, answer: BatchAnswer): Promise<void> {
  const { db, report } = run;
  const { seq, entity, entityId } = entry.operation;
  const error = rejection(answer);
  const undos = takeRollbacks([seq, ...entry.absorbed].reverse());
  if (undos.length < 1 + entry.absorbed.length) {
    // O-F5a: the run outlived its tab, so it stays `failed` rather than half-undone.
    await markOperation(db, seq, "failed", codeOf(error), {}, (tx) =>
      reconcileRow(tx, entity, entityId),
    );
    run.holds.blocked.add(entityId);
    report.set(seq, { kind: "rejected", error });
    return;
  }
  await settleWrite(db, seq, async (tx) => {
    for (const absorbed of entry.absorbed) await tx.objectStore("outbox").delete(absorbed);
    for (const undo of undos) await undo(tx);
  });
  report.set(seq, { kind: "rejected", error });
  run.result.progressed = true;
}

async function applyAnswers(
  run: BatchRun,
  sent: Collapsed[],
  response: SyncBatchResponse,
): Promise<void> {
  const answers = new Map(response.results.map((answer) => [answer.opId, answer]));
  const unanswered: number[] = [];
  for (const entry of sent) {
    const answer = answers.get(entry.operation.opId);
    if (!answer) {
      unanswered.push(entry.operation.seq);
      continue;
    }
    // A re-mint rewrote the operations still queued: the plan's copy of this one is behind the vault.
    const fresh = run.stale ? await run.db.get("outbox", entry.operation.seq) : undefined;
    const current: Collapsed = fresh ? { ...entry, operation: fresh } : entry;
    if (
      answer.status === "applied" ||
      answer.status === "duplicate" ||
      answer.status === "merged"
    ) {
      await applyLanded(run, current, answer);
    } else if (answer.status === "conflict") {
      await applyConflict(run, current, answer);
    } else if (answer.status === "rejected") {
      await applyRejected(run, current, answer);
    } else {
      // `blocked` was never attempted, so counting one would stop it from ever being folded again.
      await holdOperations(run.db, [current.operation.seq]);
      run.holds.blocked.add(current.operation.entityId);
      run.report.set(current.operation.seq, {
        kind: "held",
        on: answer.blockedBy ?? current.operation.entityId,
      });
    }
  }
  if (unanswered.length > 0) {
    // Not taken for landed: it stays in the queue with the server's own failure on it.
    await requeueOperations(run.db, unanswered, "INTERNAL");
    for (const seq of unanswered) run.report.set(seq, { kind: "queued", code: "INTERNAL" });
  }
}

// §6 O-F5b: up to 200 operations and a megabyte; what it cannot take goes behind, in `seq` order.
async function sendBatch(
  db: VaultDb,
  entries: Collapsed[],
  report: DrainReport,
): Promise<PassResult> {
  const result = emptyPass();
  const holds = initialHolds(entries);
  const run: BatchRun = { db, report, result, holds, stale: false };

  const sendable: Collapsed[] = [];
  for (const entry of entries) {
    const operation = entry.operation;
    if (operation.status === "conflict" || operation.status === "failed") continue;
    const waitingOn = heldOn(operation, holds);
    if (waitingOn !== undefined) {
      holds.blocked.add(operation.entityId);
      report.set(operation.seq, { kind: "held", on: waitingOn });
      continue;
    }
    holds.creating.delete(operation.entityId);
    sendable.push(entry);
  }
  if (sendable.length === 0) return result;

  // The queue as it stands, never the plan: what an earlier batch settled must not go twice.
  const byRoute = async (): Promise<PassResult> =>
    sendPlanned(db, coalesce(await pendingOperations(db)).operations, report);

  // Spans every batch of this pass: the rows already guarded must not be guarded again (F-61).
  const guarded = new Set<string>();
  for (const chunk of chunkBatch(sendable)) {
    const sent: Collapsed[] = [];
    for (const entry of chunk) {
      // An earlier batch of this pass may have left a row blocked: what named it waits for the next.
      const waitingOn = heldOn(entry.operation, holds);
      if (waitingOn !== undefined) {
        holds.blocked.add(entry.operation.entityId);
        report.set(entry.operation.seq, { kind: "held", on: waitingOn });
        continue;
      }
      for (const absorbed of entry.absorbed) {
        report.set(absorbed, { kind: "absorbed", into: entry.operation.seq });
      }
      sent.push(entry);
    }
    if (sent.length === 0) continue;
    const seqs = sent.map((entry) => entry.operation.seq);
    await beginSending(db, seqs);
    let response: SyncBatchResponse;
    try {
      response = await postBatch(batchBody(sent, guarded));
    } catch (error) {
      await holdOperations(db, seqs);
      if (isBatchMissing(error)) {
        state.transport = "routes";
        return byRoute();
      }
      if (isEnvelopeRefused(error)) return byRoute();
      await requeueOperations(db, seqs, codeOf(error));
      for (const seq of seqs) report.set(seq, { kind: "queued", code: codeOf(error) });
      result.stopped = true;
      result.unauthorized = isUnauthorized(error);
      if (error instanceof ApiError && error.retryAfterSeconds) {
        result.retryAfterMs = error.retryAfterSeconds * 1_000;
      }
      // Nothing is reordered and nothing is dropped: the rest of the queue waits its turn.
      return result;
    }
    result.answered = true;
    // F-66: the server's own clock, which the §8.2 warning and the Fix the date sheet use.
    await rememberServerTime(db, response.serverTime);
    await applyAnswers(run, sent, response);
    // A moved guard or a re-minted id means the batches behind describe a queue that changed.
    if (run.stale) return result;
  }
  return result;
}

// §4.2: the backoff is the one timer — no periodic pull, no periodic push.
export type Scheduler = (run: () => void, delayMs: number) => () => void;

const timeoutScheduler: Scheduler = (run, delayMs) => {
  const timer = setTimeout(run, delayMs);
  return () => {
    clearTimeout(timer);
  };
};

// §6 O-F5b, with routes as the fallback; one 404 or 501 settles it for the session (2026-09-06).
export type SyncTransport = "batch" | "routes";

interface EngineState {
  transport: SyncTransport;
  inFlight: Promise<DrainReport> | null;
  wanted: number;
  served: number;
  failures: number;
  schedule: Scheduler;
  cancelRetry: (() => void) | null;
  // Set by a 401 and cleared by a refresh or a fresh sign-in; while it is on, nothing is sent.
  paused: boolean;
  afterRound: (() => Promise<void> | void) | null;
  random: () => number;
  stop: (() => void) | null;
}

const state: EngineState = {
  transport: "batch",
  inFlight: null,
  wanted: 0,
  served: 0,
  failures: 0,
  schedule: timeoutScheduler,
  cancelRetry: null,
  paused: false,
  afterRound: null,
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
  let answered = false;
  let retryAfterMs = 0;
  let backOff = false;

  try {
    for (;;) {
      // A write that lands after this runs `wanted` ahead, so `requestSync` asks for another pass.
      state.served = state.wanted;
      if (connectivityStore.getSnapshot() === "offline") break;
      const plan = coalesce(await pendingOperations(db));
      if (plan.cancelled.length > 0) {
        await cancel(db, plan.cancelled, report);
        await refreshOutboxStatus(db);
        continue;
      }
      if (plan.operations.length === 0) break;
      const outcome =
        state.transport === "batch"
          ? await sendBatch(db, plan.operations, report)
          : await sendPlanned(db, plan.operations, report);
      await refreshOutboxStatus(db);
      answered ||= outcome.answered;
      if (outcome.stopped) {
        // F-26: a dead session is not a slow network, so the queue holds until `resumeSyncEngine`.
        if (outcome.unauthorized) {
          state.paused = true;
          clearRetry();
          return report;
        }
        backOff = true;
        retryAfterMs = outcome.retryAfterMs;
        break;
      }
      if (!outcome.progressed) break;
    }

    // §4.2: a pull after every round the server answered, and never on a background timer.
    if (answered && state.afterRound) await state.afterRound();
  } catch (error) {
    // F-27: the write is queued and durable, so the pass ends like a cut network, not a failure.
    reportError(error, "vault");
    backOff = true;
    retryAfterMs = 0;
  }
  if (backOff) {
    state.failures += 1;
    scheduleRetry(retryAfterMs);
  } else {
    state.failures = 0;
    clearRetry();
  }
  // Whatever the queue still holds is work for a wake-up the app may not be open for.
  if (outboxStatusStore.getSnapshot().pending > 0) void registerBackgroundSync();
  reportSynced(report);
  return report;
}

// Single flight: a request arriving after the pass's last look asks for a pass of its own.
export function requestSync(): Promise<DrainReport> {
  const vault = currentVault();
  if (!vault) return Promise.resolve(EMPTY_REPORT);
  if (state.paused) return Promise.resolve(EMPTY_REPORT);
  // §2.6: sending now would file one user's writes under another's session.
  const marker = readSessionMarker();
  if (marker && marker.userId !== vault.userId) return Promise.resolve(EMPTY_REPORT);
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
  // The pull of §4.2, run after a round in which the server answered something about the data.
  afterRound?: () => Promise<void> | void;
  random?: () => number;
  schedule?: Scheduler;
}

// The four triggers of the plan; there is no periodic timer, only the backoff.
export function startSyncEngine(options: SyncEngineOptions = {}): () => void {
  state.stop?.();
  state.afterRound = options.afterRound ?? null;
  state.random = options.random ?? Math.random;
  state.schedule = options.schedule ?? timeoutScheduler;
  state.failures = 0;
  state.paused = false;
  state.transport = "batch";

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
    state.afterRound = null;
    state.schedule = timeoutScheduler;
    state.failures = 0;
  };
  state.stop = stop;
  return stop;
}

// F-26: nothing was lost while the engine was paused, so the queue goes out now.
export function resumeSyncEngine(): void {
  if (!state.paused) return;
  state.paused = false;
  state.failures = 0;
  void requestSync();
}

export function isSyncPaused(): boolean {
  return state.paused;
}

// O-F6: Ajustes › Sync status has to say it, and the fallback's own tests set it.
export const syncTransport = (): SyncTransport => state.transport;

export function setSyncTransport(transport: SyncTransport): void {
  state.transport = transport;
}

// F-33: a direct send never touched the mirror, so the one caller with no round asks for a pull.
export async function pullAfterDirectSend(): Promise<void> {
  await state.afterRound?.();
}

// Test seam: the queue survives, the engine's in-memory bookkeeping does not.
// H-47: dropping an in-flight drain does not stop it, so it lands on the next test's fetch mock.
export async function resetSyncEngine(): Promise<void> {
  state.stop?.();
  clearRetry();
  state.paused = true;
  await state.inFlight?.catch(() => undefined);
  state.transport = "batch";
  state.inFlight = null;
  state.wanted = 0;
  state.served = 0;
  state.failures = 0;
  state.paused = false;
  state.afterRound = null;
  state.random = Math.random;
  state.schedule = timeoutScheduler;
  resetSynced();
  rollbacks.clear();
}
