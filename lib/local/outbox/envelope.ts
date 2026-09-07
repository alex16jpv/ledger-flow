import { v7 as uuidv7 } from "uuid";

import type { BalanceTransaction } from "../derive";
import type { OutboxEntity, OutboxOperation } from "../schema";

// The actions the queue knows how to replay. They are the API's own verbs, one per route the outbox
// covers, because the engine of O-F4 part 2 rebuilds the request from `entity` + `action` + `body`.
export const OUTBOX_ACTIONS = {
  account: ["create", "update", "archive", "restore", "setDefault"],
  category: ["create", "update", "archive", "restore"],
  transaction: ["create", "quickAdd", "update", "delete"],
  budget: ["create", "update", "archive", "restore", "setOverride", "clearOverride"],
} as const satisfies Record<OutboxEntity, readonly string[]>;

export type OutboxAction<E extends OutboxEntity = OutboxEntity> =
  (typeof OUTBOX_ACTIONS)[E][number];

// The actions whose desired state is "this row is gone". A 404 from the server is what they asked
// for, not a failure (O-B2: a deleted transaction answers 404, never 409 with a `current`).
const REMOVALS = new Set<string>(["archive", "delete"]);

export const isRemoval = (action: string): boolean => REMOVALS.has(action);

// The money side of the row an operation replaces and of the row it leaves. A projection cannot ask
// the mirror for the first one: the mirror already holds the optimistic row. Deltas telescope, so a
// second operation on the same row records what the first one left, and their sum is still the
// distance between the server's row and what the screen shows.
export interface MoneyEffect {
  before: BalanceTransaction | null;
  after: BalanceTransaction | null;
}

// What the server is asked for, plus what the figure moved. `body` is the request body verbatim so
// the engine can replay it without re-deriving it from the mirror.
export interface OperationPayload {
  body?: unknown;
  query?: Record<string, string>;
  effect?: MoneyEffect;
}

// uuid v7, like the idempotency keys: a valid UUID for the server's `z.string().uuid()`, and the
// timestamp prefix keeps a queue readable in the order it was written.
export const newEntityId = (): string => uuidv7();
export const newOpId = (): string => uuidv7();

export interface OperationDraft {
  entity: OutboxEntity;
  entityId: string;
  action: string;
  payload: OperationPayload;
  baseUpdatedAt?: string;
  dependsOn: string[];
}

// `seq` is the only ordering criterion (§2.8 / D-6): `occurredAt` is the device's clock and is kept
// for the screens that say "saved at", never for deciding what the server sees first.
export function envelope(
  draft: OperationDraft,
  seq: number,
  occurredAt: string,
  opVersion: number,
): OutboxOperation {
  return {
    seq,
    opId: newOpId(),
    opVersion,
    entity: draft.entity,
    entityId: draft.entityId,
    action: draft.action,
    occurredAt,
    payload: draft.payload,
    ...(draft.baseUpdatedAt === undefined ? {} : { baseUpdatedAt: draft.baseUpdatedAt }),
    dependsOn: draft.dependsOn,
    status: "pending",
    attempts: 0,
    lastError: null,
  };
}

export const operationPayload = (operation: OutboxOperation): OperationPayload =>
  operation.payload ?? {};
