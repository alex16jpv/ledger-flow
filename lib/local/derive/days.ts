import { dayKey } from "@/lib/format/dates";

// A calendar window is a run of local days, and every transaction carries the day the server froze
// on it (`dayKey`), so neither side moves when the account changes time zone. Same rule as the
// backend's `dayWindow` in its transaction repository.
export interface DayWindow {
  fromDay?: string;
  // Inclusive: the last day the half-open instant window touches.
  toDay?: string;
  from: number;
  to: number;
}

export function dayWindow(
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
): DayWindow {
  return {
    fromDay: from === undefined ? undefined : dayKey(new Date(from), timeZone),
    toDay: to === undefined ? undefined : dayKey(new Date(Date.parse(to) - 1), timeZone),
    from: from === undefined ? -Infinity : Date.parse(from),
    to: to === undefined ? Infinity : Date.parse(to),
  };
}

// A row written before the day was stored is answered by its instant, exactly as the server answers
// it, so a mirror filled by an older version still adds up while the backfill has not run.
export function withinDays(
  row: { dayKey: string | null; date: string },
  window: DayWindow,
): boolean {
  if (row.dayKey === null) {
    const at = Date.parse(row.date);
    return at >= window.from && at < window.to;
  }
  if (window.fromDay !== undefined && row.dayKey < window.fromDay) return false;
  if (window.toDay !== undefined && row.dayKey > window.toDay) return false;
  return true;
}

// The two extra days the index range needs so a day window cannot miss a row at its edges: a zone
// is at most 26 hours away from another, so a local day can sit that far from the same day
// elsewhere. The exact rule is `withinDays`; this only decides how many rows it looks at.
const EDGE_MS = 48 * 60 * 60 * 1000;

export function widenedBound(bound: string | undefined, days: -1 | 1): string | undefined {
  if (bound === undefined) return undefined;
  const at = Date.parse(bound);
  return Number.isNaN(at) ? bound : new Date(at + days * EDGE_MS).toISOString();
}
