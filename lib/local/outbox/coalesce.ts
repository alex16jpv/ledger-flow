import type { OutboxEntity, OutboxOperation } from "../schema";
import { type MoneyEffect, operationPayload } from "./envelope";

export interface Collapsed {
  operation: OutboxOperation;
  // The seqs folded into it, dropped from the queue the moment the survivor is settled.
  absorbed: number[];
}

// A row the server never saw and never will: created and deleted before either reached it.
export interface Cancelled {
  entity: OutboxEntity;
  entityId: string;
  seqs: number[];
}

export interface CoalescePlan {
  operations: Collapsed[];
  cancelled: Cancelled[];
}

// §6 O-F4: nothing folds across an operation the server has already been asked about.
const mergeable = (operation: OutboxOperation): boolean =>
  operation.status === "pending" && operation.attempts === 0;

// A key carrying `undefined` is a key the form did not send — the same rule `patch` applies.
function mergeBody(first: unknown, second: unknown): unknown {
  if (first === undefined) return second;
  if (second === undefined) return first;
  if (typeof first !== "object" || first === null) return second;
  if (typeof second !== "object" || second === null) return second;
  const merged: Record<string, unknown> = { ...(first as Record<string, unknown>) };
  for (const [key, value] of Object.entries(second)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

function withoutCleared(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return body;
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null));
}

// The FIRST operation's `before` survives: keeping the second would count its move twice.
function mergeEffect(first: OutboxOperation, second: OutboxOperation): MoneyEffect | undefined {
  const before = operationPayload(first).effect;
  const after = operationPayload(second).effect;
  if (!before && !after) return undefined;
  return { before: before?.before ?? null, after: after?.after ?? before?.after ?? null };
}

const referenceOf = (operation: OutboxOperation): string | undefined =>
  operationPayload(operation).query?.reference;

function merged(
  first: OutboxOperation,
  second: OutboxOperation,
  action: string,
  body: unknown,
): OutboxOperation {
  const effect = mergeEffect(first, second);
  const sharedExpenseId =
    operationPayload(second).sharedExpenseId ?? operationPayload(first).sharedExpenseId;
  return {
    ...first,
    action,
    // `occurredAt` is when the user last asked for this state; `seq` — the first one — is the order.
    occurredAt: second.occurredAt,
    payload: {
      ...(body === undefined ? {} : { body }),
      ...(operationPayload(second).query ? { query: operationPayload(second).query } : {}),
      ...(effect ? { effect } : {}),
      ...(sharedExpenseId === undefined ? {} : { sharedExpenseId }),
    },
    dependsOn: [...new Set([...first.dependsOn, ...second.dependsOn])],
  };
}

type Fold = { kind: "merge"; operation: OutboxOperation } | { kind: "cancel" } | null;

// Invariant 3: every operation is a desired state, and anything not named here keeps both.
function fold(first: OutboxOperation, second: OutboxOperation): Fold {
  const from = first.action;
  const to = second.action;
  const body = () => mergeBody(operationPayload(first).body, operationPayload(second).body);

  // Created and deleted before either left never happened; archiving is not this case.
  if (
    first.entity === "transaction" &&
    to === "delete" &&
    (from === "create" || from === "quickAdd")
  )
    return { kind: "cancel" };

  if (from === "create" && to === "update") {
    // A create has no way to say "no value": an update that cleared a field leaves it out instead.
    return { kind: "merge", operation: merged(first, second, "create", withoutCleared(body())) };
  }
  if (from === "update" && to === "update") {
    return { kind: "merge", operation: merged(first, second, "update", body()) };
  }
  // Two amounts written for the same budget period: only the last one is a state the user wants.
  if (
    from === "setOverride" &&
    to === "setOverride" &&
    referenceOf(first) === referenceOf(second)
  ) {
    return { kind: "merge", operation: merged(first, second, "setOverride", body()) };
  }
  return null;
}

// Folds in `seq` order and never reorders it.
export function coalesce(operations: OutboxOperation[]): CoalescePlan {
  const ordered = [...operations].sort((left, right) => left.seq - right.seq);
  const collapsed: (Collapsed | null)[] = [];
  const cancelled: Cancelled[] = [];
  const open = new Map<string, { at: number; entry: Collapsed }>();

  // A fold must not move an operation ahead of the create it depends on.
  const createdAt = new Map<string, number>();
  for (const operation of ordered) {
    if (operation.action === "create" || operation.action === "quickAdd") {
      createdAt.set(operation.entityId, operation.seq);
    }
  }
  const crossesCreate = (first: OutboxOperation, second: OutboxOperation): boolean =>
    second.dependsOn.some((id) => {
      const at = createdAt.get(id);
      return at !== undefined && at > first.seq && at < second.seq;
    });

  for (const operation of ordered) {
    const key = `${operation.entity}:${operation.entityId}`;
    const run = open.get(key);
    if (!mergeable(operation)) {
      open.delete(key);
      collapsed.push({ operation, absorbed: [] });
      continue;
    }
    if (run && !crossesCreate(run.entry.operation, operation)) {
      const result = fold(run.entry.operation, operation);
      if (result?.kind === "cancel") {
        cancelled.push({
          entity: operation.entity,
          entityId: operation.entityId,
          seqs: [run.entry.operation.seq, ...run.entry.absorbed, operation.seq],
        });
        collapsed[run.at] = null;
        open.delete(key);
        continue;
      }
      if (result) {
        run.entry.operation = result.operation;
        run.entry.absorbed.push(operation.seq);
        continue;
      }
    }
    const entry: Collapsed = { operation, absorbed: [] };
    collapsed.push(entry);
    open.set(key, { at: collapsed.length - 1, entry });
  }

  return { operations: collapsed.filter((entry) => entry !== null), cancelled };
}
