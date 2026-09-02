import { dayKey, monthWindow, shiftMonth } from "@/lib/format/dates";

const MONTH = /^\d{4}-\d{2}$/;

export function currentMonthKey(now: Date, timeZone: string): string {
  return dayKey(now, timeZone).slice(0, 7);
}

export function parseMonthKey(value: string | null, now: Date, timeZone: string): string {
  return value && MONTH.test(value) ? value : currentMonthKey(now, timeZone);
}

// Any instant inside the month works as `reference`; the local start of the month is unambiguous.
export function monthReference(
  monthKey: string,
  timeZone: string,
): { reference: Date; iso: string } {
  const reference = monthWindow(new Date(`${monthKey}-15T12:00:00Z`), timeZone).from;
  return { reference, iso: reference.toISOString() };
}

export function shiftMonthKey(monthKey: string, months: number, timeZone: string): string {
  const shifted = shiftMonth(monthReference(monthKey, timeZone).reference, months, timeZone);
  return dayKey(shifted, timeZone).slice(0, 7);
}
