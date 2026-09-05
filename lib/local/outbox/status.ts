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
  conflicts: number;
  projected: OutboxProjection;
}

export const EMPTY_OUTBOX: OutboxStatus = {
  pending: 0,
  conflicts: 0,
  projected: { balances: false, spending: false, budgets: false },
};

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

function summarise(operations: OutboxOperation[]): OutboxStatus {
  return {
    pending: operations.length,
    conflicts: operations.filter((operation) => operation.status === "conflict").length,
    projected: projectionOf(operations),
  };
}

const same = (left: OutboxStatus, right: OutboxStatus): boolean =>
  left.pending === right.pending &&
  left.conflicts === right.conflicts &&
  left.projected.balances === right.projected.balances &&
  left.projected.spending === right.projected.spending &&
  left.projected.budgets === right.projected.budgets;

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

export function resetOutboxStatus(): void {
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
