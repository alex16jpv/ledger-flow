import { dayKey } from "@/lib/format/dates";
import type { StatsBucket } from "@/types/api";

export const UNCATEGORIZED_KEY = "uncategorized";
export const UNTAGGED_KEY = "untagged";

export interface Share {
  key: string;
  total: number;
  count: number;
  share: number;
}

// Shares are proportions of the API total; the client divides, it never re-adds money.
export function shares(buckets: readonly StatsBucket[], total: number): Share[] {
  return [...buckets]
    .sort((a, b) => b.total - a.total)
    .map((bucket) => ({
      key: bucket.key,
      total: bucket.total,
      count: bucket.count,
      share: total > 0 ? bucket.total / total : 0,
    }));
}

export function transactionCount(buckets: readonly StatsBucket[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.count, 0);
}

export interface DaySeries {
  bars: { value: number; label: string; today?: boolean; key: string }[];
  highest: StatsBucket | null;
  noSpendDays: number;
  dailyAverage: number;
}

// The API skips empty days; the chart shows every day of the window with zeros in the gaps.
export function daySeries(
  buckets: readonly StatsBucket[],
  window: { from: Date; to: Date },
  timeZone: string,
  now: Date,
  total: number,
): DaySeries {
  const byDay = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const todayKey = dayKey(now, timeZone);
  const bars: DaySeries["bars"] = [];
  for (
    let cursor = new Date(window.from);
    cursor < window.to;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const key = dayKey(cursor, timeZone);
    if (bars.some((bar) => bar.key === key)) continue;
    bars.push({ key, value: byDay.get(key)?.total ?? 0, label: key, today: key === todayKey });
  }
  const elapsed = bars.filter((bar) => bar.key <= todayKey);
  const counted = elapsed.length > 0 ? elapsed : bars;
  const highest = [...buckets].sort((a, b) => b.total - a.total)[0] ?? null;
  return {
    bars,
    highest,
    noSpendDays: counted.filter((bar) => bar.value === 0).length,
    dailyAverage: counted.length > 0 ? total / counted.length : 0,
  };
}
