import { dayKey } from "@/lib/format/dates";

// Same rule as the backend's `dayWindow`: local days, and the day the server froze on the row.
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

// A row written before the day was stored is answered by its instant, as the server answers it.
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

// A zone is at most 26 h from another, so the index range widens by two days; `withinDays` rules.
const EDGE_MS = 48 * 60 * 60 * 1000;

export function widenedBound(bound: string | undefined, days: -1 | 1): string | undefined {
  if (bound === undefined) return undefined;
  const at = Date.parse(bound);
  return Number.isNaN(at) ? bound : new Date(at + days * EDGE_MS).toISOString();
}
