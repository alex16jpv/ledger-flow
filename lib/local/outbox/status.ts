import type { OutboxOperation } from "../schema";
import { pendingOperations, type VaultDb } from "./queue";

// Which derived figures a queued operation can move. Invariant 2 forbids painting a projection as a
// figure the server sent, and from the first queued write that is exactly what `spent`, the buckets,
// the month's spending and the balances become (F-16).
export interface OutboxProjection {
  balances: boolean;
  spending: boolean;
  budgets: boolean;
}

export interface OutboxStatus {
  pending: number;
  // Conflicts AND definitive refusals: both are stuck until the user decides, and a `failed`
  // operation the queue could not undo is as far from the server as one in conflict (F-23).
  attention: number;
  // The rows a screen can mark: everything with something queued, and the subset the user has to
  // act on. The first is ids alone — a row badge asks "is this one waiting?" and nothing more; the
  // second carries the `seq` of the first stuck operation on the row, which is what a screen opens
  // the conflict sheet on (F-29).
  queuedRows: ReadonlySet<string>;
  attentionRows: ReadonlyMap<string, number>;
  // Where "Review" goes: the first operation, in queue order, that needs a decision.
  firstAttention: number | null;
  // The last thing the server (or the network) said no with, for Ajustes › Sync status.
  lastError: string | null;
  // Operations an app update left behind: written by an older version of the app, and this one has
  // no migration for them, so they will never reach the server on their own (F-65). Everything
  // recorded from now on syncs normally — nothing waits behind these.
  blocked: readonly number[];
  projected: OutboxProjection;
}

const NO_ROWS: ReadonlySet<string> = new Set<string>();
const NO_ATTENTION: ReadonlyMap<string, number> = new Map<string, number>();

export const EMPTY_OUTBOX: OutboxStatus = {
  pending: 0,
  attention: 0,
  queuedRows: NO_ROWS,
  attentionRows: NO_ATTENTION,
  firstAttention: null,
  lastError: null,
  blocked: [],
  projected: { balances: false, spending: false, budgets: false },
};

const needsAttention = (operation: OutboxOperation): boolean =>
  operation.status === "conflict" || operation.status === "failed";

function projectionOf(operations: OutboxOperation[]): OutboxProjection {
  // A queued movement moves every money figure at once: it is a row the server's aggregations have
  // not seen. An account create adds an opening balance; a budget write changes its own view.
  const money = operations.some((operation) => operation.entity === "transaction");
  return {
    balances:
      money ||
      operations.some(
        (operation) => operation.entity === "account" && operation.action === "create",
      ),
    spending: money,
    budgets: money || operations.some((operation) => operation.entity === "budget"),
  };
}

let blocked: readonly number[] = [];

function summarise(operations: OutboxOperation[]): OutboxStatus {
  const stuck = operations.filter(needsAttention);
  return {
    // Discarding one is the only thing that can take it off the list, and that is a change of the
    // queue like any other.
    blocked: blocked.filter((seq) => operations.some((operation) => operation.seq === seq)),
    pending: operations.length,
    attention: stuck.length,
    queuedRows: new Set(operations.map((operation) => operation.entityId)),
    // Reversed so the lowest `seq` on a row is the one that survives the collapse into a map.
    attentionRows: new Map(
      [...stuck].reverse().map((operation) => [operation.entityId, operation.seq]),
    ),
    firstAttention: stuck[0]?.seq ?? null,
    lastError:
      [...operations].reverse().find((operation) => operation.lastError)?.lastError ?? null,
    projected: projectionOf(operations),
  };
}

const sameRows = (left: ReadonlySet<string>, right: ReadonlySet<string>): boolean =>
  left.size === right.size && [...left].every((id) => right.has(id));

const sameAttention = (
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
): boolean => left.size === right.size && [...left].every(([id, seq]) => right.get(id) === seq);

const sameBlocked = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((seq, index) => right[index] === seq);

const same = (left: OutboxStatus, right: OutboxStatus): boolean =>
  sameBlocked(left.blocked, right.blocked) &&
  left.pending === right.pending &&
  left.attention === right.attention &&
  left.firstAttention === right.firstAttention &&
  left.lastError === right.lastError &&
  left.projected.balances === right.projected.balances &&
  left.projected.spending === right.projected.spending &&
  left.projected.budgets === right.projected.budgets &&
  sameRows(left.queuedRows, right.queuedRows) &&
  sameAttention(left.attentionRows, right.attentionRows);

type Listener = () => void;

const listeners = new Set<Listener>();
let status: OutboxStatus = EMPTY_OUTBOX;

function publish(next: OutboxStatus): void {
  // useSyncExternalStore compares snapshots by reference, so an unchanged queue keeps the old one.
  if (same(status, next)) return;
  status = next;
  for (const listener of listeners) listener();
}

export async function refreshOutboxStatus(db: VaultDb): Promise<OutboxStatus> {
  publish(summarise(await pendingOperations(db)));
  return status;
}

// What `openVault` found it could not migrate. Set once, when the vault opens, and cleared with the
// status: nothing else in the app can turn an operation into a blocked one.
export function setBlockedOperations(seqs: readonly number[]): void {
  blocked = seqs;
  publish({ ...status, blocked: seqs });
}

export function resetOutboxStatus(): void {
  blocked = [];
  publish(EMPTY_OUTBOX);
}

export const outboxStatusStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): OutboxStatus => status,
  getServerSnapshot: (): OutboxStatus => EMPTY_OUTBOX,
};
