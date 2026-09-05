import type { Account, Category, SyncBudget, SyncTransaction } from "@/types/api";

import { resolvePeriod } from "../derive";
import type { OutboxEntity, OutboxOperation } from "../schema";
import { operationPayload } from "./envelope";
import { patch } from "./projected";
import type { RouteKey } from "./routes";

// D-23: only what is still going out. A `conflict` or a `failed` operation will never be sent, so
// the mirror shows the row the server sent and the user's version lives in the conflict sheet.
export const willBeSent = (operation: OutboxOperation): boolean =>
  operation.status === "pending" || operation.status === "sending";

export type MirrorRow = Account | Category | SyncTransaction | SyncBudget;

// What the mirror has to project back on top of a page of the feed: the queue grouped by the row
// each operation addresses, in `seq` order, which is the order they will reach the server.
export interface QueuedMirror {
  rows: ReadonlyMap<string, readonly OutboxOperation[]>;
  // The account a queued `setDefault` is about to hand the flag to, if any; the last one wins.
  defaultAccountId: string | null;
  // Absent until the first pull brings the profile. A budget override cannot resolve its period
  // without the owner's zone, so it is left alone rather than filed under the wrong key.
  timezone: string | null;
}

const rowKey = (entity: OutboxEntity, id: string): string => `${entity}:${id}`;

export function queuedMirror(
  operations: readonly OutboxOperation[],
  timezone: string | null,
): QueuedMirror {
  const rows = new Map<string, OutboxOperation[]>();
  let defaultAccountId: string | null = null;
  for (const operation of [...operations].sort((left, right) => left.seq - right.seq)) {
    if (!willBeSent(operation)) continue;
    const key = rowKey(operation.entity, operation.entityId);
    const queued = rows.get(key);
    if (queued) queued.push(operation);
    else rows.set(key, [operation]);
    if (operation.entity === "account" && operation.action === "setDefault") {
      defaultAccountId = operation.entityId;
    }
  }
  return { rows, defaultAccountId, timezone };
}

const bodyOf = (operation: OutboxOperation): Record<string, unknown> => {
  const body = operationPayload(operation).body;
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
};

// The envelope keeps the request body verbatim, so its fields are only known to be the row's here.
const merge = <T extends object>(row: T, operation: OutboxOperation): T =>
  patch(row, bodyOf(operation) as Partial<T>);

function periodKey(
  budget: SyncBudget,
  operation: OutboxOperation,
  timezone: string | null,
): string | null {
  const reference = operationPayload(operation).query?.reference;
  if (!reference || !timezone) return null;
  return resolvePeriod(budget, new Date(reference), timezone).key;
}

type Rule = (row: MirrorRow, operation: OutboxOperation, queued: QueuedMirror) => MirrorRow;

// One rule per route, the mirror image of what each write projects when it is queued. A create has
// none on purpose: the server can only send back a row it already holds, so a create in the feed is
// one whose answer was lost, and the server's row is the more current of the two.
const RULES: Partial<Record<RouteKey, Rule>> = {
  "account:update": (row, operation) => merge(row as Account, operation),
  "account:archive": (row, operation) => ({
    ...(row as Account),
    archivedAt: operation.occurredAt,
  }),
  "account:restore": (row, operation) =>
    merge({ ...(row as Account), archivedAt: null }, operation),
  "account:setDefault": (row) => ({ ...(row as Account), isDefault: true }),

  "category:update": (row, operation) => merge(row as Category, operation),
  "category:archive": (row, operation) => ({
    ...(row as Category),
    archivedAt: operation.occurredAt,
  }),
  "category:restore": (row, operation) =>
    merge({ ...(row as Category), archivedAt: null }, operation),

  "transaction:update": (row, operation) => merge(row as SyncTransaction, operation),
  "transaction:delete": (row, operation) => ({
    ...(row as SyncTransaction),
    deletedAt: operation.occurredAt,
  }),

  "budget:update": (row, operation) => merge(row as SyncBudget, operation),
  "budget:archive": (row, operation) => ({
    ...(row as SyncBudget),
    archivedAt: operation.occurredAt,
  }),
  "budget:restore": (row) => ({ ...(row as SyncBudget), archivedAt: null }),
  "budget:setOverride": (row, operation, queued) => {
    const budget = row as SyncBudget;
    const key = periodKey(budget, operation, queued.timezone);
    const { amount } = bodyOf(operation);
    if (key === null || typeof amount !== "number") return budget;
    return { ...budget, amountOverrides: { ...budget.amountOverrides, [key]: amount } };
  },
  "budget:clearOverride": (row, operation, queued) => {
    const budget = row as SyncBudget;
    const key = periodKey(budget, operation, queued.timezone);
    if (key === null) return budget;
    return {
      ...budget,
      amountOverrides: Object.fromEntries(
        Object.entries(budget.amountOverrides).filter(([period]) => period !== key),
      ),
    };
  },
};

// The row the mirror keeps once a page of the feed has been applied: the server's, with the
// operations that have not left the queue projected on top of it, in the order they will leave
// (D-23). `updatedAt` is never touched, so the stamp the next write guards against stays the
// server's own (invariant 2).
export function reproject<R extends MirrorRow>(
  entity: OutboxEntity,
  row: R,
  queued: QueuedMirror,
): R {
  let next: MirrorRow = row;
  for (const operation of queued.rows.get(rowKey(entity, row.id)) ?? []) {
    const rule = RULES[`${entity}:${operation.action}` as RouteKey];
    if (rule) next = rule(next, operation, queued);
  }
  // Two defaults would have quick capture pick the wrong account for as long as the queue holds
  // the operation that moves the flag, so the account it is moving away from gives it up here too.
  if (entity === "account" && queued.defaultAccountId && queued.defaultAccountId !== row.id) {
    next = { ...(next as Account), isDefault: false };
  }
  return next as R;
}
