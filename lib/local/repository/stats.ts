import type { IDBPDatabase } from "idb";

import { api } from "@/lib/api/client";
import type { QueryValue } from "@/lib/api/query";
import type { StatsResponse, SyncTransaction } from "@/types/api";

import { deriveSpending, type SpendingGroupBy, type SpendingSplitBy } from "../derive";
import type { VaultSchema } from "../schema";
import { idList, isoBound, oneOf, sent, unsupported } from "./params";
import { read } from "./read";
import { liveRowsInWindow, mirrorTimeZone } from "./window";

// Unparseable is a 400 on the server, and an inverted window is what IDBKeyRange.bound throws on.
export function bounds(
  rawFrom: QueryValue,
  rawTo: QueryValue,
): { from?: string; to?: string } | null {
  const from = isoBound(rawFrom);
  const to = isoBound(rawTo);
  if (from === null || to === null) return null;
  if (from !== undefined && to !== undefined && from > to) return null;
  return { from, to };
}

// An index signature: the query travels to `api` verbatim, so the online URL is unchanged.
export interface SpendingQuery extends Record<string, QueryValue> {
  groupBy?: SpendingGroupBy;
  type?: SyncTransaction["type"];
  // A comma-separated list, which is the form the server's own parser takes.
  categoryIds?: string;
  splitBy?: SpendingSplitBy;
  from?: string;
  to?: string;
}

const SUPPORTED_PARAMS = new Set(["groupBy", "type", "categoryIds", "splitBy", "from", "to"]);
const GROUPINGS = new Set<SpendingGroupBy>(["category", "day", "month", "account", "tag"]);
const SPLITTABLE = new Set<SpendingGroupBy>(["month", "account"]);
export const TYPES = new Set<SyncTransaction["type"]>([
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "ADJUSTMENT",
]);

// The one seam for /stats/spending: all six call sites paint one derivation, not six.
export function readSpending(query: SpendingQuery): Promise<StatsResponse> {
  return read<StatsResponse>(
    () => api<StatsResponse>("/stats/spending", { query }),
    (db) => spendingFromMirror(db, query),
  );
}

async function spendingFromMirror(
  db: IDBPDatabase<VaultSchema>,
  query: SpendingQuery,
): Promise<StatsResponse | undefined> {
  if (unsupported(query, SUPPORTED_PARAMS)) return undefined;

  // A value the schema would reject is a 400 on the server, so the mirror declines it too.
  const asked = oneOf<SpendingGroupBy>(query.groupBy, GROUPINGS);
  const wanted = oneOf<SyncTransaction["type"]>(query.type, TYPES);
  const split = oneOf<"category">(query.splitBy, new Set(["category"]));
  if (asked === null || wanted === null || split === null) return undefined;
  // StatsController's `type` default is EXPENSE, not the service's everything-but-ADJUSTMENT.
  const groupBy = asked ?? "category";
  const type = wanted ?? "EXPENSE";
  const splitBy = split ?? null;
  // The server splits only the two groupings a window keeps bounded, and only inside one.
  if (splitBy !== null && !SPLITTABLE.has(groupBy)) return undefined;
  if (splitBy !== null && !(sent(query.from) && sent(query.to))) return undefined;

  const window = bounds(query.from, query.to);
  if (window === null) return undefined;

  const categoryIds = idList(query.categoryIds);
  if (categoryIds === null) return undefined;

  const timeZone = await mirrorTimeZone(db);
  if (timeZone === undefined) return undefined;

  // No bounds is the whole history, which is what a category's "n transactions" counts.
  const rows = await liveRowsInWindow(db, window.from, window.to);
  const { total, buckets } = deriveSpending(rows, {
    groupBy,
    type,
    categoryIds,
    splitBy,
    from: window.from,
    to: window.to,
    timeZone,
  });
  return { groupBy, splitBy, buckets, total };
}
