import type { OutboxOperation } from "../schema";
import { operationPayload } from "./envelope";
import { pendingOperations, type VaultDb } from "./queue";

// F-16 with invariant 2: from the first queued write these figures become projections.
export interface OutboxProjection {
  balances: boolean;
  spending: boolean;
  budgets: boolean;
}

export interface OutboxStatus {
  pending: number;
  // F-23: conflicts and definitive refusals both — a `failed` operation is as far from the server.
  attention: number;
  // F-29: `queuedRows` is ids alone; `attentionRows` carries the seq the sheet opens on.
  queuedRows: ReadonlySet<string>;
  attentionRows: ReadonlyMap<string, number>;
  // Where "Review" goes: the first operation, in queue order, that needs a decision.
  firstAttention: number | null;
  // The last thing the server (or the network) said no with, for Ajustes › Sync status.
  lastError: string | null;
  // F-65: written by an older app with no migration here; nothing new waits behind them.
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
  // A queued movement moves every money figure at once; an account create only its opening.
  const money = operations.some(
    (operation) => operation.entity === "transaction" || operation.entity === "settlement",
  );
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

const carriedIds = (operation: OutboxOperation): string[] => {
  const { sharedExpenseId } = operationPayload(operation);
  return sharedExpenseId === undefined ? [] : [sharedExpenseId];
};

function summarise(operations: OutboxOperation[]): OutboxStatus {
  const stuck = operations.filter(needsAttention);
  return {
    // Discarding one is the only thing that takes it off the list, and that is a queue change.
    blocked: blocked.filter((seq) => operations.some((operation) => operation.seq === seq)),
    pending: operations.length,
    attention: stuck.length,
    queuedRows: new Set(
      operations.flatMap((operation) => [
        operation.entityId,
        ...(operationPayload(operation).minted ?? []),
        ...carriedIds(operation),
      ]),
    ),
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

// Set once when the vault opens: nothing else in the app can turn an operation into a blocked one.
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
