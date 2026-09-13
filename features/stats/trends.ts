import { type DateWindow, dayKey, monthWindow, shiftMonth } from "@/lib/format/dates";
import { runningTotals, sumAmounts } from "@/lib/local/derive";
import type { StatsBucket } from "@/types/api";

import { daySeries } from "./model";

export const TREND_RANGES = [6, 12] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

export const TOP_CATEGORIES = 5;

export function isTrendRange(value: number): value is TrendRange {
  return (TREND_RANGES as readonly number[]).includes(value);
}

export interface TrendMonth {
  key: string;
  from: Date;
  income: number;
  spending: number;
  running: boolean;
}

export function trendWindow(end: Date, months: TrendRange, timeZone: string): DateWindow {
  return {
    from: monthWindow(shiftMonth(end, -(months - 1), timeZone), timeZone).from,
    to: monthWindow(end, timeZone).to,
  };
}

// A month is named by its own first instant in the user's zone: an ISO string would name the one before.
const monthStarts = (window: DateWindow, months: TrendRange, timeZone: string): Date[] =>
  Array.from(
    { length: months },
    (_, step) => monthWindow(shiftMonth(window.from, step, timeZone), timeZone).from,
  );

export const monthKeyOf = (start: Date, timeZone: string): string =>
  dayKey(start, timeZone).slice(0, 7);

// A month before the first one with data is a month this device cannot see, not a month of zeros.
export function trendMonths(
  income: readonly StatsBucket[],
  spending: readonly StatsBucket[],
  window: DateWindow,
  months: TrendRange,
  timeZone: string,
  runningKey: string | null,
): TrendMonth[] {
  const byIncome = new Map(income.map((bucket) => [bucket.key, bucket.total]));
  const bySpending = new Map(spending.map((bucket) => [bucket.key, bucket.total]));
  const starts = monthStarts(window, months, timeZone).map((from) => ({
    from,
    key: monthKeyOf(from, timeZone),
  }));
  const first = starts.findIndex(({ key }) => byIncome.has(key) || bySpending.has(key));
  if (first < 0) return [];
  return starts.slice(first).map(({ key, from }) => ({
    key,
    from,
    income: byIncome.get(key) ?? 0,
    spending: bySpending.get(key) ?? 0,
    running: key === runningKey,
  }));
}

export interface Savings {
  saved: number;
  rate: number | null;
  complete: number;
}

// Rule 4: the range totals are the API's own, and the running month is taken off them, never added up.
export function savings(
  incomeTotal: number,
  spendingTotal: number,
  months: readonly TrendMonth[],
): Savings {
  const running = months.find((month) => month.running);
  const earned = sumAmounts([incomeTotal, -(running?.income ?? 0)]);
  const spent = sumAmounts([spendingTotal, -(running?.spending ?? 0)]);
  const saved = sumAmounts([earned, -spent]);
  return {
    saved,
    rate: earned > 0 ? saved / earned : null,
    complete: months.filter((month) => !month.running).length,
  };
}

export interface MonthComparison {
  current: (number | null)[];
  previous: (number | null)[];
  spentSoFar: number;
  previousSoFar: number;
  difference: number | null;
  days: number;
  comparedDays: number;
}

// The two months are walked day by day from their own first day, so day 12 is compared with day 12.
export function monthComparison(
  current: readonly StatsBucket[],
  previous: readonly StatsBucket[],
  currentWindow: DateWindow,
  previousWindow: DateWindow,
  timeZone: string,
  now: Date,
): MonthComparison {
  const here = daySeries(current, currentWindow, timeZone, now, 0);
  const there = daySeries(previous, previousWindow, timeZone, now, 0);
  const elapsed = here.bars.filter((bar) => !bar.future);
  const days = elapsed.length;
  // A shorter previous month runs out first, so both are read at the last day the two of them have.
  const comparedDays = Math.min(days, there.bars.length);
  const hereTotals = runningTotals(elapsed.map((bar) => bar.value));
  const thereTotals = runningTotals(there.bars.slice(0, comparedDays).map((bar) => bar.value));
  const previousSoFar = thereTotals.at(-1) ?? 0;
  const hereCompared = hereTotals[comparedDays - 1] ?? 0;
  return {
    current: [0, ...hereTotals],
    previous: [0, ...thereTotals],
    spentSoFar: hereTotals.at(-1) ?? 0,
    previousSoFar,
    difference: previousSoFar > 0 ? (hereCompared - previousSoFar) / previousSoFar : null,
    days,
    comparedDays,
  };
}

export interface MixSegment {
  key: string;
  total: number;
}

export interface MixColumn {
  key: string;
  from: Date;
  total: number;
  running: boolean;
  segments: MixSegment[];
}

export const OTHER_KEY = "other";

// The top five are ranked by the API's own category totals; "Other" is what the month's total has left.
export function categoryMix(
  months: readonly TrendMonth[],
  buckets: readonly StatsBucket[],
  ranking: readonly string[],
): MixColumn[] {
  const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const top = ranking.slice(0, TOP_CATEGORIES);
  return months.map((month) => {
    const bucket = byMonth.get(month.key);
    const splits = new Map((bucket?.splits ?? []).map((split) => [split.key, split.total]));
    const named = top.flatMap((key) => {
      const total = splits.get(key) ?? 0;
      return total > 0 ? [{ key, total }] : [];
    });
    const other = sumAmounts([bucket?.total ?? 0, ...named.map((segment) => -segment.total)]);
    return {
      key: month.key,
      from: month.from,
      total: bucket?.total ?? 0,
      running: month.running,
      segments: other > 0 ? [...named, { key: OTHER_KEY, total: other }] : named,
    };
  });
}
