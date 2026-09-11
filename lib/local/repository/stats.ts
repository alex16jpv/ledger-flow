import type { IDBPDatabase } from "idb";

import { api } from "@/lib/api/client";
import type { QueryValue } from "@/lib/api/query";
import type { StatsResponse, SyncTransaction } from "@/types/api";

import { deriveSpending, type SpendingGroupBy } from "../derive";
import type { VaultSchema } from "../schema";
import { read } from "./read";
import { liveRowsInWindow, mirrorTimeZone } from "./window";

// An index signature: the query travels to `api` verbatim, so the online URL is unchanged.
export interface SpendingQuery extends Record<string, QueryValue> {
  groupBy?: SpendingGroupBy;
  type?: SyncTransaction["type"];
  from?: string;
  to?: string;
}

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
  const timeZone = await mirrorTimeZone(db);
  if (timeZone === undefined) return undefined;

  // StatsController's `type` default is EXPENSE, not the service's everything-but-ADJUSTMENT.
  const groupBy = query.groupBy ?? "category";
  const type = query.type ?? "EXPENSE";

  // No bounds is the whole history, which is what a category's "n transactions" counts.
  const rows = await liveRowsInWindow(db, query.from, query.to);
  const { total, buckets } = deriveSpending(rows, {
    groupBy,
    type,
    from: query.from,
    to: query.to,
    timeZone,
  });
  return { groupBy, buckets, total };
}
