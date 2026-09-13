import type { QueryValue } from "@/lib/api/query";

// toQueryString skips these, so a parameter carrying one never reached the server either.
export function sent(value: QueryValue): boolean {
  return value !== undefined && value !== null && value !== "";
}

// Anything outside a read's own list would make the mirror answer a question it did not apply.
export function unsupported(
  query: Record<string, QueryValue>,
  supported: ReadonlySet<string>,
): boolean {
  return Object.entries(query).some(([key, value]) => sent(value) && !supported.has(key));
}

// Mongo breaks a tie on the key itself, which is not what a locale would do with an accented tag.
export function byKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// The server's own cap on how many categories one query may name (MAX_BUDGET_CATEGORIES).
const MAX_IDS = 20;

// null is the server's 400: an empty or oversized list is never answered as if it filtered nothing.
export function idList(raw: QueryValue): string[] | undefined | null {
  if (!sent(raw)) return undefined;
  // The server trims each id before validating it, so " c1" and "c1" are the same category.
  const ids = String(raw)
    .split(",")
    .map((id) => id.trim());
  if (ids.length > MAX_IDS || ids.some((id) => id === "")) return null;
  return ids;
}

// The server takes only ISO 8601 with an offset, so a looser bound is a question it never answered.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isoBound(raw: QueryValue): string | undefined | null {
  if (!sent(raw)) return undefined;
  const text = String(raw);
  if (!ISO_WITH_OFFSET.test(text)) return null;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

// null is the server's 400 on a value outside the enum; undefined is the parameter not being sent.
export function oneOf<T extends string>(
  raw: QueryValue,
  allowed: ReadonlySet<T>,
): T | undefined | null {
  if (!sent(raw)) return undefined;
  const text = String(raw) as T;
  return allowed.has(text) ? text : null;
}
