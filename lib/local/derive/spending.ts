import { dayKey } from "@/lib/format/dates";
import type { StatsBucket, StatsResponse, SyncTransaction } from "@/types/api";

import { fromCents, toCents } from "./money";

export type SpendingGroupBy = StatsResponse["groupBy"];

export type SpendingTransaction = Pick<
  SyncTransaction,
  "type" | "amount" | "date" | "categoryId" | "tags" | "deletedAt"
>;

export interface SpendingWindow {
  groupBy: SpendingGroupBy;
  // null is the service's "everything but ADJUSTMENT". The HTTP layer never sends it: an absent
  // `type` there means EXPENSE, and `repository/stats.ts` applies that default before calling here.
  type: SyncTransaction["type"] | null;
  from?: string;
  to?: string;
  timeZone: string;
}

// The rows the window covers, grouped and totalled the way `aggregateSpending` does it. The window
// is re-applied here rather than assumed: this is the statement of the rule, and the repository's
// index range is how it avoids walking rows it already knows are outside.
export function deriveSpending(
  transactions: SpendingTransaction[],
  window: SpendingWindow,
): { total: number; buckets: StatsBucket[] } {
  const from = window.from === undefined ? -Infinity : Date.parse(window.from);
  const to = window.to === undefined ? Infinity : Date.parse(window.to);

  const matched = transactions.filter((transaction) => {
    if (transaction.deletedAt) return false;
    // ADJUSTMENT is reconciliation, not cash flow: it is hidden unless the query names it.
    if (window.type ? transaction.type !== window.type : transaction.type === "ADJUSTMENT") {
      return false;
    }
    const at = Date.parse(transaction.date);
    // Half-open [from, to): a row at the closing instant belongs to the next window, never to two.
    return at >= from && at < to;
  });

  const totals = new Map<string, { cents: number; count: number }>();
  const add = (key: string, cents: number): void => {
    const bucket = totals.get(key) ?? { cents: 0, count: 0 };
    bucket.cents += cents;
    bucket.count += 1;
    totals.set(key, bucket);
  };

  for (const transaction of matched) {
    const cents = toCents(transaction.amount);
    if (window.groupBy === "day") {
      add(dayKey(new Date(transaction.date), window.timeZone), cents);
    } else if (window.groupBy === "category") {
      add(transaction.categoryId ?? "uncategorized", cents);
    } else if (transaction.tags.length === 0) {
      add("untagged", cents);
    } else {
      // The server unwinds the tags: a two-tag row is counted in both buckets and once in the
      // total, so the buckets can add up to more than `total`.
      for (const tag of transaction.tags) add(tag, cents);
    }
  }

  const buckets = [...totals].map(([key, bucket]) => ({
    key,
    total: fromCents(bucket.cents),
    count: bucket.count,
    // Rounded in minor units, exactly where the server rounds it: 10.01 over 2 rows is 5.01.
    avg: fromCents(Math.round(bucket.cents / bucket.count)),
  }));
  // Day buckets are a time series; the rest rank by spend. The key breaks a tie the server leaves
  // to Mongo, which no fixture exercises because no two of its buckets share a total.
  buckets.sort((a, b) =>
    window.groupBy === "day"
      ? a.key.localeCompare(b.key)
      : b.total - a.total || a.key.localeCompare(b.key),
  );

  return {
    total: fromCents(matched.reduce((cents, row) => cents + toCents(row.amount), 0)),
    buckets,
  };
}
