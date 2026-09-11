import type { OutboxOperation } from "../schema";
import { operationPayload } from "./envelope";

// §6 O-F5a: the classification lives here only; `pendingDetails` is a review flag, not money.
export const TEXT_FIELDS: ReadonlySet<string> = new Set([
  "description",
  "note",
  "tags",
  "name",
  "color",
  "icon",
  "pendingDetails",
]);

// `text` retries over the server's stamp; `structural` is asked about, never merged silently.
export type ConflictKind = "text" | "structural";

const bodyOf = (operation: OutboxOperation): Record<string, unknown> | null => {
  const body = operationPayload(operation).body;
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
};

// A form sends only the fields it changed, so a key carrying `undefined` is one it did not send.
const changedFields = (body: Record<string, unknown>): string[] =>
  Object.keys(body).filter((field) => body[field] !== undefined);

export function conflictKind(operation: OutboxOperation): ConflictKind {
  // Only an edit can merge by retrying: a create carries no guard, and the rest are shape.
  if (operation.action !== "update") return "structural";
  const body = bodyOf(operation);
  if (!body) return "structural";
  const fields = changedFields(body);
  if (fields.length === 0) return "structural";
  return fields.every((field) => TEXT_FIELDS.has(field)) ? "text" : "structural";
}

const same = (left: unknown, right: unknown): boolean =>
  left === right || JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export interface ConflictField {
  name: string;
  // What this device wanted, and what the server answered it already had.
  mine: unknown;
  theirs: unknown;
  disputed: boolean;
}

// A field both sides agree on is context; only the disputed ones are highlighted.
export function conflictFields(operation: OutboxOperation, serverRow: unknown): ConflictField[] {
  const body = bodyOf(operation);
  if (!body) return [];
  const server = (typeof serverRow === "object" && serverRow !== null ? serverRow : {}) as Record<
    string,
    unknown
  >;
  return changedFields(body)
    .filter((field) => field !== "id")
    .map((field) => ({
      name: field,
      mine: body[field],
      theirs: server[field],
      disputed: !same(body[field], server[field]),
    }));
}

// A `DUPLICATE` answers with somebody else's row, which must never become this row's baseline.
export function ownServerRow(operation: OutboxOperation): unknown {
  const row = operation.serverRow as { id?: unknown } | null | undefined;
  return row?.id === operation.entityId ? operation.serverRow : undefined;
}

// F-60: the one refusal trying again cannot fix, and the one a restore's `name` can.
export function isNameTaken(operation: OutboxOperation): boolean {
  return (
    operation.action === "restore" &&
    (operation.entity === "account" || operation.entity === "category") &&
    operation.lastError === "DUPLICATE"
  );
}

// F-66: trying again unchanged repeats the refusal; the way out is the date itself.
export function isFutureDate(operation: OutboxOperation): boolean {
  return operation.entity === "transaction" && operation.lastError === "FUTURE_DATE";
}

// The stamp a retry has to guard against: the one the server answered the 409 with.
export function serverStamp(operation: OutboxOperation): string | undefined {
  const row = ownServerRow(operation);
  const updatedAt = (row as { updatedAt?: unknown } | null | undefined)?.updatedAt;
  return typeof updatedAt === "string" ? updatedAt : undefined;
}
