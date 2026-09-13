import { dayKey } from "@/lib/format/dates";
import type { StatsBucket, StatsResponse, StatsSplit, SyncTransaction } from "@/types/api";

import { dayWindow, withinDays } from "./days";
import { fromCents, toCents } from "./money";

export type SpendingGroupBy = StatsResponse["groupBy"];
export type SpendingSplitBy = StatsResponse["splitBy"];

export type SpendingTransaction = Pick<
  SyncTransaction,
  | "type"
  | "amount"
  | "date"
  | "dayKey"
  | "categoryId"
  | "fromAccountId"
  | "toAccountId"
  | "tags"
  | "deletedAt"
>;

export interface SpendingWindow {
  groupBy: SpendingGroupBy;
  // null is everything but ADJUSTMENT; the HTTP layer never sends it, EXPENSE is applied before.
  type: SyncTransaction["type"] | null;
  categoryIds?: string[];
  splitBy?: SpendingSplitBy;
  from?: string;
  to?: string;
  timeZone: string;
}

const UNCATEGORIZED = "uncategorized";
const UNTAGGED = "untagged";
const UNASSIGNED = "unassigned";

interface Total {
  cents: number;
  count: number;
  splits: Map<string, Total>;
}

function bucketKeys(
  transaction: SpendingTransaction,
  groupBy: SpendingGroupBy,
  day: string,
): string[] {
  switch (groupBy) {
    case "day":
      return [day];
    case "month":
      return [day.slice(0, 7)];
    case "category":
      return [transaction.categoryId ?? UNCATEGORIZED];
    case "account": {
      // An increase-only ADJUSTMENT has no `fromAccountId`, and income arrives rather than leaves.
      const own =
        transaction.type === "INCOME" ? transaction.toAccountId : transaction.fromAccountId;
      return [own ?? transaction.toAccountId ?? UNASSIGNED];
    }
    case "tag":
      // The server unwinds the tags, so the buckets can add up to more than `total`.
      return transaction.tags.length === 0 ? [UNTAGGED] : transaction.tags;
  }
}

function addTo(totals: Map<string, Total>, key: string, cents: number): Total {
  const total = totals.get(key) ?? { cents: 0, count: 0, splits: new Map<string, Total>() };
  total.cents += cents;
  total.count += 1;
  totals.set(key, total);
  return total;
}

function asBucket([key, total]: [string, Total]): StatsBucket {
  return {
    key,
    total: fromCents(total.cents),
    count: total.count,
    // Rounded in minor units, exactly where the server rounds it: 10.01 over 2 rows is 5.01.
    avg: fromCents(Math.round(total.cents / total.count)),
  };
}

// Mongo breaks a tie on the key's bytes, which is not what a locale would do with an accented tag.
const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Day and month buckets are a time series; the rest rank by spend, with the key breaking Mongo's tie.
function ordered(totals: Map<string, Total>, series: boolean): [string, Total][] {
  return [...totals].sort(([aKey, a], [bKey, b]) =>
    series ? byKey(aKey, bKey) : b.cents - a.cents || byKey(aKey, bKey),
  );
}

// The window is re-applied here rather than assumed: this is the statement of the rule.
export function deriveSpending(
  transactions: SpendingTransaction[],
  window: SpendingWindow,
): { total: number; buckets: StatsBucket[] } {
  const days = dayWindow(window.from, window.to, window.timeZone);
  const only = window.categoryIds?.length ? new Set(window.categoryIds) : undefined;

  const matched = transactions.filter((transaction) => {
    if (transaction.deletedAt) return false;
    // ADJUSTMENT is reconciliation, not cash flow: it is hidden unless the query names it.
    if (window.type ? transaction.type !== window.type : transaction.type === "ADJUSTMENT") {
      return false;
    }
    if (only && (transaction.categoryId === null || !only.has(transaction.categoryId)))
      return false;
    // The window is the run of calendar days it covers, matched against the day frozen on the row.
    return withinDays(transaction, days);
  });

  const totals = new Map<string, Total>();
  for (const transaction of matched) {
    const cents = toCents(transaction.amount);
    const day = transaction.dayKey ?? dayKey(new Date(transaction.date), window.timeZone);
    for (const key of bucketKeys(transaction, window.groupBy, day)) {
      const bucket = addTo(totals, key, cents);
      if (window.splitBy === "category") {
        addTo(bucket.splits, transaction.categoryId ?? UNCATEGORIZED, cents);
      }
    }
  }

  const series = window.groupBy === "day" || window.groupBy === "month";
  const buckets = ordered(totals, series).map((entry) => {
    const bucket = asBucket(entry);
    if (window.splitBy !== "category") return bucket;
    const splits: StatsSplit[] = ordered(entry[1].splits, false).map(asBucket);
    return { ...bucket, splits };
  });

  return {
    total: fromCents(matched.reduce((cents, row) => cents + toCents(row.amount), 0)),
    buckets,
  };
}
