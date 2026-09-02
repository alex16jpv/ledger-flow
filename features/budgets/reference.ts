import { dayKey, localDateTime, shiftMonth } from "@/lib/format/dates";

const MONTH = /^\d{4}-\d{2}$/;

export function currentMonthKey(now: Date, timeZone: string): string {
  return dayKey(now, timeZone).slice(0, 7);
}

export function parseMonthKey(value: string | null, now: Date, timeZone: string): string {
  return value && MONTH.test(value) ? value : currentMonthKey(now, timeZone);
}

// Any instant inside the month works as `reference`. Noon on the 15th stays inside it even if the server
// resolves the period in a different zone than the client; the local midnight of the 1st does not.
export function monthReference(
  monthKey: string,
  timeZone: string,
): { reference: Date; iso: string } {
  const reference = localDateTime(`${monthKey}-15`, "12:00", timeZone);
  return { reference, iso: reference.toISOString() };
}

export function shiftMonthKey(monthKey: string, months: number, timeZone: string): string {
  const shifted = shiftMonth(monthReference(monthKey, timeZone).reference, months, timeZone);
  return dayKey(shifted, timeZone).slice(0, 7);
}
