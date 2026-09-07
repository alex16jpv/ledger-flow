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

// The plan's numbers (§6 O-F4). The step doubles from a second to a minute; the jitter can only
// shorten it, so a fleet of devices that lost the network together does not come back in lockstep.
export const BACKOFF_MIN_MS = 1_000;
export const BACKOFF_MAX_MS = 60_000;

// How many times a text-only edit may rebase itself onto a fresh stamp before it stops being bad
// luck and starts being a row somebody else is writing continuously. Then it asks, like the rest.
export const AUTO_MERGE_ATTEMPTS = 5;

export type DrainOutcome =
  | { kind: "sent"; result: unknown }
  // It landed and the server sent no row back: a duplicate `opId` the registry answered from
  // memory. The screen keeps the projection it already had and the pull of the round brings the row.
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

// The refresh already had its turn inside `lib/api` (a 401 here means it failed), so retrying is
// asking a dead session the same question every minute until the tab closes (F-26).
const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;

// A server with no batch endpoint: the front was deployed ahead of its backend. One answer settles
// it for the session and the queue keeps leaving by the ordinary routes (owner, 2026-09-06).
const isBatchMissing = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 404 || error.status === 501);

// The envelope itself was refused, so nothing in the batch was applied: this client built a batch
// the server cannot read, or one over the megabyte. The plan goes out one request at a time instead,
// where each operation gets the verdict of its own route rather than the queue stalling on a batch
// nobody can fix.
const isEnvelopeRefused = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 400 || error.status === 413);

// The `updatedAt` a successful write answers with, when it answers a row at all.
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

// True while the write that made this operation is still waiting for it: `write()` registers the
// undo before it asks for the drain, and drops it as soon as it answers the screen from the
// projection. So an undo still registered means a form is on screen waiting for this very pass —
// and an answer it cannot act on belongs to it, not to a tray it never opened.
const awaited = (seq: number): boolean => rollbacks.has(seq);

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

// Marks the operations as being asked about without counting the attempt: `markOperation` does that
// once, when the answer is in. A tab killed mid-flight leaves `sending` behind, which the next pass
// picks up like any other queued operation — and which coalescing will not fold across.
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
  // The server said something about the data — a write that landed, a conflict, a refusal — so the
  // mirror may be behind it and the round ends with a pull (F-32). A network failure or a 5xx says
  // nothing new, and does not.
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
  // The ids nothing may be sent against: an operation in conflict or refused for good, and anything
  // that named it. Only its dependents are held; the rest of the queue keeps going.
  blocked: Set<string>;
  // The rows whose create is still ahead in this plan: nothing that names one may go first. With
  // `seq` alone this never happens; it is the belt for any fold that moves an operation earlier.
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
          result.answered = true;
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
        // Nobody left to hand the error to — this operation, or one folded into it, outlived the tab
        // that made it. Undoing only half of a fold would leave the mirror at an edit the server never
        // got, with no operation behind it; the whole run stays in the queue as `failed` so the tray
        // of O-F5a can show it, rather than vanishing.
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
  // A re-mint moved ids under the queue, or a landed answer moved a guard: whatever is left of the
  // plan describes a queue that no longer exists, so the pass looks at it again.
  stale: boolean;
}

// The refusal as the route itself would have raised it, so the form maps it by `code` exactly as it
// does online and the tray reads the same table. `requestId` names the batch, the way the mirror's
// own refusals name themselves (`repository/read`): there is one request behind many operations.
const rejection = (answer: BatchAnswer): ApiError =>
  new ApiError({
    status: answer.status === "conflict" ? 409 : answer.code === "NOT_FOUND" ? 404 : 400,
    code: isErrorCode(answer.code) ? answer.code : null,
    message: answer.message ?? "The server refused this change",
    details: answer.details,
    requestId: "sync",
    current: answer.current,
  });

// What the mirror does with an operation the server took. With a row, the route's own `confirm`;
// without one — a `transaction:delete`, an archive that answers a message, an `opId` the registry
// answered from memory — the baseline moves the way the operation asked, or the row is reprojected
// without it, and the pull that closes the round brings what the server actually holds.
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

// `applied`, `duplicate` and `merged`: the operation's desired state is on the server, so it leaves
// the queue whatever the answer carried.
// The server landed the create on a row it already had, and a form is waiting to hear it created
// one. The re-mint stands — the row does exist, under the server's id — and the form is told what
// the route would have told it: the name is taken, which is the one thing it can act on.
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
  // F-57: the server landed the create on a row it already had (same name and type). The id moves
  // everywhere this device wrote it — the mirror row, the rows that name it and the operations still
  // queued — or the queue keeps pointing at an id the server does not have, and no pull fixes it.
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
  // The contract answers every conflict with a code; the OpenAPI cannot say "required for this
  // status", so a missing one is not guessed — it falls through to the sheet with what came.
  const { code, current } = answer;

  // O-B1 with D-17: the id belongs to ANOTHER user, so the row takes a new one and goes back in the
  // queue instead of an error nobody can act on (F-21).
  if (code === "ID_TAKEN" && !operation.reminted) {
    const minted = newEntityId();
    await remint(db, entity, entityId, minted);
    report.set(seq, { kind: "reminted", entityId: minted });
    run.result.progressed = true;
    run.stale = true;
    return;
  }
  const stamp = stampOf(current);
  // §6 O-F5a: an edit that only carries text merges by itself over the stamp the server answered
  // with. A stamp that did not move would only conflict again, so it is not retried.
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
  // Everything else is the server saying no for a reason the queue cannot rebase away: a name
  // already taken, a reference it will not accept, an id that is not this user's. If a form is
  // waiting for it, that is where the answer belongs — a taken name is fixed by typing another one,
  // not in a tray the user never opened, and it is what the route itself would have answered.
  if (code !== "STALE_UPDATE" && awaited(seq)) {
    await applyRejected(run, entry, answer);
    return;
  }
  // `RESOURCE_ARCHIVED` answers with the ARCHIVED ACCOUNT, not with the row the operation is about:
  // it is not this operation's server version, it is the row its resolution acts on (F-58). The
  // mirror learns the account is archived — which is true, and is what the sheet reads to offer
  // restoring it — and the operation keeps only its id.
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
    // Nobody left to hand the error to — this operation, or one folded into it, outlived the tab
    // that made it. The whole run stays in the queue as `failed` for the tray of O-F5a rather than
    // vanishing, and undoing only the half it still can would leave the mirror at an edit the
    // server never got.
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
      // `blocked`: never attempted, because a row it names failed earlier in the same batch. It
      // goes back in line untouched — counting an attempt would stop it from ever being folded
      // again for a batch it was not part of — and its own row waits with it.
      await holdOperations(run.db, [current.operation.seq]);
      run.holds.blocked.add(current.operation.entityId);
      run.report.set(current.operation.seq, {
        kind: "held",
        on: answer.blockedBy ?? current.operation.entityId,
      });
    }
  }
  if (unanswered.length > 0) {
    // The batch came back without a word about this operation. It is not taken for landed: it stays
    // in the queue with the server's own failure on it, visible in Ajustes › Sync status.
    await requeueOperations(run.db, unanswered, "INTERNAL");
    for (const seq of unanswered) run.report.set(seq, { kind: "queued", code: "INTERNAL" });
  }
}

// The queue leaves in one request (§6 O-F5b): `POST /sync` takes up to 200 operations of up to a
// megabyte and answers one status per operation, over the same queue transitions the routes drove
// one error code at a time. What it cannot take goes in the batch behind it, in `seq` order.
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

  // Falls back to one request per operation with the queue as it stands, never with the plan: what
  // an earlier batch already settled must not be sent a second time.
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
    // The server's own clock, which is what the form of §8.2 warns against and the "Fix the date"
    // sheet prefills with (F-66).
    await rememberServerTime(db, response.serverTime);
    await applyAnswers(run, sent, response);
    // A guard moved or an id was re-minted: the batches behind this one describe a queue that has
    // changed, and the pass builds the plan again.
    if (run.stale) return result;
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

// How the queue leaves. `POST /sync` is what the plan asks for (§6 O-F5b); the ordinary routes are
// the fallback for a server that has no batch endpoint, and one 404 or 501 settles it for the rest
// of the session (owner, 2026-09-06: the front can be deployed ahead of its backend).
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
      const outcome =
        state.transport === "batch"
          ? await sendBatch(db, plan.operations, report)
          : await sendPlanned(db, plan.operations, report);
      await refreshOutboxStatus(db);
      answered ||= outcome.answered;
      if (outcome.stopped) {
        // A dead session is not a slow network: waiting longer never fixes it, so the queue holds
        // where it is until `resumeSyncEngine` says the user is back (F-26).
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
    // IndexedDB failing mid-pass, or a bug: the write is already queued and durable, so the pass
    // ends like a cut network — report, back off, come back — instead of rejecting the caller and
    // telling a form that a saved write failed (F-27).
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

// Single flight: while one drain is running every other trigger joins it. A request that arrives
// after the running pass took its last look at the queue is not lost — it asks for a pass of its own
// once this one is done, which is what keeps a write queued mid-drain from waiting for a click.
export function requestSync(): Promise<DrainReport> {
  const vault = currentVault();
  if (!vault) return Promise.resolve(EMPTY_REPORT);
  if (state.paused) return Promise.resolve(EMPTY_REPORT);
  // Somebody else signed in on this device while this tab held a vault open: sending now would file
  // one user's writes under another's session (§2.6). The queue waits for its own user to come back.
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

// Wires the four triggers the plan asks for: back online, app open (the caller's first request),
// regaining focus, and Background Sync where it exists. There is no periodic timer — only the
// backoff, and only while the queue still holds something.
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

// The session is back: a refresh landed, or the user signed in again. Nothing was lost while the
// engine was paused, so the queue goes out now (F-26).
export function resumeSyncEngine(): void {
  if (!state.paused) return;
  state.paused = false;
  state.failures = 0;
  void requestSync();
}

export function isSyncPaused(): boolean {
  return state.paused;
}

// Which transport the queue is leaving by, and the switch the 404 answer throws. Ajustes › Sync
// status (O-F6) is the screen that has to say it, and the fallback's own tests set it.
export const syncTransport = (): SyncTransport => state.transport;

export function setSyncTransport(transport: SyncTransport): void {
  state.transport = transport;
}

// A write that went straight to the server never touched the mirror, so the screen that reads the
// mirror would not see what it just saved until something else pulled (F-33). It is the same pull a
// round makes, asked for by the one caller that has no round.
export async function pullAfterDirectSend(): Promise<void> {
  await state.afterRound?.();
}

// Test seam: the queue survives, the engine's in-memory bookkeeping does not.
export function resetSyncEngine(): void {
  state.stop?.();
  clearRetry();
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
