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

// The hard rule (§6 O-F4): nothing is ever folded across an operation the server has already been
// asked about. A dispatched operation may have landed, a conflicted one is waiting for the user, and
// merging later edits into either would either hide the conflict or replay a request under a guard
// that no longer holds. Such an operation still goes out — on its own.
const mergeable = (operation: OutboxOperation): boolean =>
  operation.status === "pending" && operation.attempts === 0;

// A form sends the fields it changed, so a key carrying `undefined` is a key it did not send: the
// same rule `patch` applies to the mirror, applied to the body the queue will replay.
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

// The `before` that survives is the FIRST operation's: the projection of a balance is the mirror's
// figure plus the distance the queue moved it, and the mirror stopped holding the server's row at
// the first write. Keeping the second `before` would count that first move twice.
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
  return {
    ...first,
    action,
    // `occurredAt` is when the user last asked for this state; `seq` — the first one — is the order.
    occurredAt: second.occurredAt,
    payload: {
      ...(body === undefined ? {} : { body }),
      ...(operationPayload(second).query ? { query: operationPayload(second).query } : {}),
      ...(effect ? { effect } : {}),
    },
    dependsOn: [...new Set([...first.dependsOn, ...second.dependsOn])],
  };
}

type Fold = { kind: "merge"; operation: OutboxOperation } | { kind: "cancel" } | null;

// Every operation is a desired state (invariant 3), so where the second one states the whole of what
// the first one did, the first can go. Anything not named here keeps both operations.
function fold(first: OutboxOperation, second: OutboxOperation): Fold {
  const from = first.action;
  const to = second.action;
  const body = () => mergeBody(operationPayload(first).body, operationPayload(second).body);

  // A movement created and deleted before either left the device never happened: the server is not
  // told about it at all. Archiving is not this case — an archived account is still the user's row.
  if (
    first.entity === "transaction" &&
    to === "delete" &&
    (from === "create" || from === "quickAdd")
  )
    return { kind: "cancel" };

  if (from === "create" && to === "update") {
    return { kind: "merge", operation: merged(first, second, "create", body()) };
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

// Folds what is about to be sent, in `seq` order and never reordering it. Editing the same row ten
// times offline leaves one request; creating and deleting a movement leaves none.
export function coalesce(operations: OutboxOperation[]): CoalescePlan {
  const ordered = [...operations].sort((left, right) => left.seq - right.seq);
  const collapsed: (Collapsed | null)[] = [];
  const cancelled: Cancelled[] = [];
  const open = new Map<string, { at: number; entry: Collapsed }>();

  // A fold moves the second operation to the first one's place. It must not move it ahead of a
  // create it depends on: the server would refuse a movement against an account it has not seen.
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
