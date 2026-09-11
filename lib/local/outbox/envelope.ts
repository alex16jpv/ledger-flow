import { v7 as uuidv7 } from "uuid";

import type { BalanceTransaction } from "../derive";
import type { OutboxEntity, OutboxOperation } from "../schema";

// O-F4 part 2 rebuilds the request from `entity` + `action` + `body`, so these are the API's verbs.
export const OUTBOX_ACTIONS = {
  account: ["create", "update", "archive", "restore", "setDefault"],
  category: ["create", "update", "archive", "restore"],
  transaction: ["create", "quickAdd", "update", "delete"],
  budget: ["create", "update", "archive", "restore", "setOverride", "clearOverride"],
} as const satisfies Record<OutboxEntity, readonly string[]>;

export type OutboxAction<E extends OutboxEntity = OutboxEntity> =
  (typeof OUTBOX_ACTIONS)[E][number];

// O-B2: for these a 404 is what they asked for, never a 409 with a `current`.
const REMOVALS = new Set<string>(["archive", "delete"]);

export const isRemoval = (action: string): boolean => REMOVALS.has(action);

// Deltas telescope: the mirror already holds the optimistic row, so `before` cannot come from it.
export interface MoneyEffect {
  before: BalanceTransaction | null;
  after: BalanceTransaction | null;
}

// `body` is the request body verbatim, so the engine replays without re-deriving it.
export interface OperationPayload {
  body?: unknown;
  query?: Record<string, string>;
  effect?: MoneyEffect;
}

// uuid v7: valid for the server's `z.string().uuid()`, and the prefix keeps the queue readable.
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

// §2.8 / D-6: `seq` is the only ordering criterion; `occurredAt` is only for the screens.
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
