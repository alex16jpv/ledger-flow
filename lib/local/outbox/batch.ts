import { api } from "@/lib/api/client";
import type { SyncBatchInput, SyncBatchResponse } from "@/types/api";

import type { OutboxOperation } from "../schema";
import type { Collapsed } from "./coalesce";
import { operationPayload } from "./envelope";

export type SyncOperationInput = SyncBatchInput["operations"][number];

// The batch's own limits (backend `src/shared/syncBatch.ts`): 1–200 operations and a body of 1 MB,
// where every other route stops at 10 kB. The budget is short of the megabyte because the envelope
// around the operations is not free, and a queue that guessed too high would earn a `413`.
export const SYNC_MAX_OPERATIONS = 200;
export const SYNC_BODY_BUDGET_BYTES = 900_000;

const bytesOf = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

const bodyOf = (payload: unknown): Record<string, unknown> | undefined =>
  typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : undefined;

// `seq` on the wire is the rank inside the batch, not the device's counter (D-33). The server takes
// an integer and uses it for one thing — the order it applies the batch in — while a resolution
// queued ahead of the operation it unblocks holds a fractional local `seq` (F-58) that the server's
// `z.number().int()` would refuse. Results are matched by `opId`, never by `seq`.
export function wireOperation(
  operation: OutboxOperation,
  rank: number,
  guarded: boolean,
): SyncOperationInput {
  const payload = operationPayload(operation);
  const body = bodyOf(payload.body);
  const reference = payload.query?.reference;
  return {
    opId: operation.opId,
    seq: rank,
    occurredAt: operation.occurredAt,
    entity: operation.entity,
    action: operation.action,
    id: operation.entityId,
    // `effect` stays at home: it is the money the row moved, bookkeeping for the local projection,
    // and the server has no field for it.
    payload: {
      ...(body === undefined ? {} : { body }),
      ...(reference === undefined ? {} : { query: { reference } }),
    },
    ...(guarded && operation.baseUpdatedAt !== undefined
      ? { baseUpdatedAt: operation.baseUpdatedAt }
      : {}),
    dependsOn: operation.dependsOn,
    opVersion: operation.opVersion,
  };
}

// D-34: inside one batch only the first operation of a row carries its `If-Match`. The ones behind
// it were queued against the stamp the first one is about to replace (D-22), and a batch has no gap
// to rebase them in. Unguarded they open no window: `POST /sync` blocks by entity id, so if the
// first one conflicts the rest come back `blocked` without ever being applied (D-30).
export function batchBody(entries: Collapsed[]): SyncBatchInput {
  const guarded = new Set<string>();
  return {
    operations: entries.map((entry, rank) => {
      const { entity, entityId } = entry.operation;
      const key = `${entity}:${entityId}`;
      const first = !guarded.has(key);
      guarded.add(key);
      return wireOperation(entry.operation, rank, first);
    }),
  };
}

// Cuts the queue into batches the server will accept, in `seq` order and never reordering it.
export function chunkBatch(entries: Collapsed[]): Collapsed[][] {
  const chunks: Collapsed[][] = [];
  let current: Collapsed[] = [];
  let bytes = 0;
  for (const entry of entries) {
    const cost = bytesOf(wireOperation(entry.operation, 0, true)) + 1;
    const full = current.length >= SYNC_MAX_OPERATIONS || bytes + cost > SYNC_BODY_BUDGET_BYTES;
    // An operation over the budget on its own still goes: a `413` is a truer answer than a queue
    // that stops draining, and the fallback gives it the verdict of its own route.
    if (current.length > 0 && full) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(entry);
    bytes += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export const postBatch = (body: SyncBatchInput): Promise<SyncBatchResponse> =>
  api<SyncBatchResponse>("/sync", { method: "POST", body });
