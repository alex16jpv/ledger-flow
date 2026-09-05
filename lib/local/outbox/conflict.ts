import type { OutboxOperation } from "../schema";
import { operationPayload } from "./envelope";

// §6 O-F5a: the text/money classification lives in the front, in one place. The server never needs
// to know it, and a second copy in the other repo would drift from this one.
export const TEXT_FIELDS: ReadonlySet<string> = new Set([
  "description",
  "note",
  "tags",
  "name",
  "color",
  "icon",
]);

// "text" retries itself over the stamp the server answered with; "structural" is money or shape and
// is asked about, because merging it would silently pick a winner the user never chose.
export type ConflictKind = "text" | "structural";

const bodyOf = (operation: OutboxOperation): Record<string, unknown> | null => {
  const body = operationPayload(operation).body;
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
};

// A form sends only the fields it changed, so a key carrying `undefined` is one it did not send.
const changedFields = (body: Record<string, unknown>): string[] =>
  Object.keys(body).filter((field) => body[field] !== undefined);

export function conflictKind(operation: OutboxOperation): ConflictKind {
  // Only an edit can be merged by retrying: a create carries no guard at all, and archiving,
  // restoring or making an account the default are shape, not a field with two versions.
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

// The two versions side by side, over the fields the operation actually asked to change. A field
// both sides agree on is still shown — it is context for the one that differs — but only the
// disputed ones are highlighted.
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

// The stamp a retry has to guard against: the one the server answered the 409 with.
export function serverStamp(operation: OutboxOperation): string | undefined {
  const row = operation.serverRow;
  const updatedAt = (row as { updatedAt?: unknown } | null | undefined)?.updatedAt;
  return typeof updatedAt === "string" ? updatedAt : undefined;
}
