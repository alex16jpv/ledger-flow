import { type DateWindow, dayKey, localDateTime, shiftMonth } from "@/lib/format/dates";
import type { Budget } from "@/types/api";

const MONTH = /^\d{4}-\d{2}$/;

export function currentMonthKey(now: Date, timeZone: string): string {
  return dayKey(now, timeZone).slice(0, 7);
}

export function parseMonthKey(value: string | null, now: Date, timeZone: string): string {
  return value && MONTH.test(value) ? value : currentMonthKey(now, timeZone);
}

// Any instant inside the month works as `reference`. The current month uses "now", so a CUSTOM window
// that is still open today is not reported as expired; a past month uses noon on the 15th, which stays
// inside it even if the server resolved the period in another zone.
export function monthReference(
  monthKey: string,
  timeZone: string,
  now: Date = new Date(),
): { reference: Date; iso: string } {
  const reference =
    monthKey === currentMonthKey(now, timeZone)
      ? now
      : localDateTime(`${monthKey}-15`, "12:00", timeZone);
  return { reference, iso: reference.toISOString() };
}

// A CUSTOM window is one-shot: it belongs only to the months it overlaps, not to every month before it ends.
export function overlapsMonth(
  budget: Pick<Budget, "periodType" | "periodFrom" | "periodTo">,
  window: DateWindow,
): boolean {
  if (budget.periodType !== "CUSTOM") return true;
  return new Date(budget.periodFrom) < window.to && new Date(budget.periodTo) > window.from;
}

export function shiftMonthKey(monthKey: string, months: number, timeZone: string): string {
  const anchor = localDateTime(`${monthKey}-15`, "12:00", timeZone);
  const shifted = shiftMonth(anchor, months, timeZone);
  return dayKey(shifted, timeZone).slice(0, 7);
}
