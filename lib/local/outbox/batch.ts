import { api } from "@/lib/api/client";
import { SESSION_USER_HEADER } from "@/lib/auth/cookies";
import type { SyncBatchInput, SyncBatchResponse } from "@/types/api";

import type { OutboxOperation } from "../schema";
import type { Collapsed } from "./coalesce";
import { operationPayload } from "./envelope";

export type SyncOperationInput = SyncBatchInput["operations"][number];

// Backend `src/shared/syncBatch.ts`: 1–200 operations and 1 MB, minus the envelope, or a `413`.
export const SYNC_MAX_OPERATIONS = 200;
export const SYNC_BODY_BUDGET_BYTES = 900_000;

const bytesOf = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

const bodyOf = (payload: unknown): Record<string, unknown> | undefined =>
  typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : undefined;

// D-33: `seq` on the wire is the rank in the batch; results match by `opId`, never by `seq`.
export function wireOperation(
  operation: OutboxOperation,
  rank: number,
  guarded: boolean,
): SyncOperationInput {
  const payload = operationPayload(operation);
  const body = bodyOf(payload.body);
  const reference = payload.query?.reference;
  const params = payload.params;
  return {
    opId: operation.opId,
    seq: rank,
    occurredAt: operation.occurredAt,
    entity: operation.entity,
    action: operation.action,
    id: operation.entityId,
    // `effect` stays at home: bookkeeping for the local projection, with no field on the server.
    payload: {
      ...(body === undefined ? {} : { body }),
      ...(reference === undefined ? {} : { query: { reference } }),
      ...(params === undefined ? {} : { params }),
    },
    ...(guarded && operation.baseUpdatedAt !== undefined
      ? { baseUpdatedAt: operation.baseUpdatedAt }
      : {}),
    dependsOn: operation.dependsOn,
    opVersion: operation.opVersion,
  };
}

// D-34: only the first operation of a row per PASS carries its `If-Match` (D-22, D-30, F-61).
export function batchBody(entries: Collapsed[], guarded = new Set<string>()): SyncBatchInput {
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
    // An operation over the budget still goes: a `413` beats a queue that stops draining.
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

// T-152: the proxy refuses the batch when the session that would apply it is not the queue's owner.
export const postBatch = (body: SyncBatchInput, userId: string): Promise<SyncBatchResponse> =>
  api<SyncBatchResponse>("/sync", {
    method: "POST",
    body,
    headers: { [SESSION_USER_HEADER]: userId },
  });
