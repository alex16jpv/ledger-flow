import type { QueryValue } from "@/lib/api/query";
import {
  type DateWindow,
  daysWindow,
  monthWindow,
  shiftMonth,
  toIsoWindow,
  weekWindow,
  yearWindow,
} from "@/lib/format/dates";

import type { TransactionType } from "./form";

export const PERIOD_PRESETS = ["week", "month", "lastMonth", "year", "custom", "all"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export interface TransactionFilters {
  period: PeriodPreset;
  from: string | null;
  to: string | null;
  type: TransactionType | null;
  accountId: string | null;
  categoryId: string | null;
  uncategorized: boolean;
  tag: string | null;
  pendingDetails: boolean;
  quickOnly: boolean;
  q: string;
}

export const DEFAULT_FILTERS: TransactionFilters = {
  period: "month",
  from: null,
  to: null,
  type: null,
  accountId: null,
  categoryId: null,
  uncategorized: false,
  tag: null,
  pendingDetails: false,
  quickOnly: false,
  q: "",
};

const TYPES = new Set<string>(["EXPENSE", "INCOME", "TRANSFER", "ADJUSTMENT"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function nonEmpty(value: string | null): string | null {
  return value?.trim() ? value : null;
}

function isPreset(value: string | null): value is PeriodPreset {
  return value !== null && (PERIOD_PRESETS as readonly string[]).includes(value);
}

// Filters live in the URL so a list can be shared and survives a reload (HANDOFF §3.4).
export function parseFilters(params: URLSearchParams): TransactionFilters {
  const period = params.get("period");
  const from = params.get("from");
  const to = params.get("to");
  const type = params.get("type");
  const custom =
    isPreset(period) && period === "custom" && from && to && DATE.test(from) && DATE.test(to);
  return {
    period: custom ? "custom" : isPreset(period) && period !== "custom" ? period : "month",
    from: custom ? from : null,
    to: custom ? to : null,
    type: type && TYPES.has(type) ? (type as TransactionType) : null,
    accountId: nonEmpty(params.get("account")),
    categoryId: nonEmpty(params.get("category")),
    uncategorized: params.get("uncategorized") === "1",
    tag: nonEmpty(params.get("tag"))?.trim().toLowerCase() ?? null,
    pendingDetails: params.get("pending") === "1",
    quickOnly: params.get("source") === "QUICK",
    q: params.get("q") ?? "",
  };
}

export function serializeFilters(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.period !== "month") params.set("period", filters.period);
  if (filters.period === "custom" && filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }
  if (filters.type) params.set("type", filters.type);
  if (filters.accountId) params.set("account", filters.accountId);
  if (filters.categoryId) params.set("category", filters.categoryId);
  if (filters.uncategorized) params.set("uncategorized", "1");
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.pendingDetails) params.set("pending", "1");
  if (filters.quickOnly) params.set("source", "QUICK");
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return params;
}

export function countActiveFilters(filters: TransactionFilters): number {
  return [
    filters.period !== "month",
    filters.type !== null,
    filters.accountId !== null,
    filters.categoryId !== null || filters.uncategorized,
    filters.tag !== null,
    filters.pendingDetails,
    filters.quickOnly,
  ].filter(Boolean).length;
}

export function periodWindow(
  filters: Pick<TransactionFilters, "period" | "from" | "to">,
  timeZone: string,
  now: Date = new Date(),
): DateWindow | null {
  switch (filters.period) {
    case "week":
      return weekWindow(now, timeZone);
    case "month":
      return monthWindow(now, timeZone);
    case "lastMonth":
      return monthWindow(shiftMonth(now, -1, timeZone), timeZone);
    case "year":
      return yearWindow(now, timeZone);
    case "custom":
      return filters.from && filters.to ? daysWindow(filters.from, filters.to, timeZone) : null;
    case "all":
      return null;
  }
}

export type ListQuery = Record<string, QueryValue>;

export function toListQuery(
  filters: TransactionFilters,
  timeZone: string,
  now: Date = new Date(),
): ListQuery {
  const window = periodWindow(filters, timeZone, now);
  return {
    ...(window ? toIsoWindow(window) : {}),
    type: filters.type ?? undefined,
    accountId: filters.accountId ?? undefined,
    categoryId: filters.uncategorized ? undefined : (filters.categoryId ?? undefined),
    uncategorized: filters.uncategorized ? "true" : undefined,
    tag: filters.tag ?? undefined,
    pendingDetails: filters.pendingDetails ? "true" : undefined,
    source: filters.quickOnly ? "QUICK" : undefined,
  };
}

// Client-side search over the loaded rows: description, note and tags; "#x" targets tags only.
export function matchesSearch(
  row: { description: string | null; note: string | null; tags: string[] },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (needle.startsWith("#")) return row.tags.some((tag) => tag.includes(needle.slice(1)));
  return [row.description, row.note, ...row.tags].some((text) =>
    (text ?? "").toLowerCase().includes(needle),
  );
}
