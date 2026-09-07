import type { IDBPDatabase } from "idb";

import { api } from "@/lib/api/client";
import type { QueryValue } from "@/lib/api/query";
import type { StatsResponse, SyncTransaction } from "@/types/api";

import { deriveSpending, type SpendingGroupBy } from "../derive";
import type { VaultSchema } from "../schema";
import { read } from "./read";
import { liveRowsInWindow, mirrorTimeZone } from "./window";

// An index signature, not just these four keys: `api` takes a Record, and the query travels to it
// verbatim so the online URL is exactly the one each call site was already sending.
export interface SpendingQuery extends Record<string, QueryValue> {
  groupBy?: SpendingGroupBy;
  type?: SyncTransaction["type"];
  from?: string;
  to?: string;
}

// The one seam for /stats/spending. All six of its call sites go through it, so the buckets a screen
// paints come from one derivation rather than six.
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

  // The defaults StatsController stamps on an absent parameter. Its `type` default is EXPENSE, not
  // the service's "everything but ADJUSTMENT": no URL can ask for that one, only a fixture can.
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
