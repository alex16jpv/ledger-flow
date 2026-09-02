import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export interface DateWindow {
  from: Date;
  to: Date;
}

// Windows are half-open [from, to) and computed in the user's zone, then expressed as UTC instants.
export function monthWindow(reference: Date, timeZone: string): DateWindow {
  const localStart = startOfMonth(toZonedTime(reference, timeZone));
  return {
    from: fromZonedTime(localStart, timeZone),
    to: fromZonedTime(addMonths(localStart, 1), timeZone),
  };
}

export function dayWindow(reference: Date, timeZone: string): DateWindow {
  const localStart = startOfDay(toZonedTime(reference, timeZone));
  return {
    from: fromZonedTime(localStart, timeZone),
    to: fromZonedTime(addDays(localStart, 1), timeZone),
  };
}

export function shiftMonth(reference: Date, months: number, timeZone: string): Date {
  const local = toZonedTime(reference, timeZone);
  return fromZonedTime(addMonths(local, months), timeZone);
}

export function localNoon(isoDate: string, timeZone: string): Date {
  return fromZonedTime(`${isoDate}T12:00:00`, timeZone);
}

export function localDateTime(isoDate: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${isoDate}T${time}:00`, timeZone);
}

export interface DateTimeParts {
  date: string;
  time: string | null;
}

// Owner decision (2026-09-01): an empty time means "now", not local noon.
export function dateTimeInstant(
  { date, time }: DateTimeParts,
  timeZone: string,
  now: Date = new Date(),
): Date {
  return localDateTime(date, time ?? dateTimeParts(now, timeZone).time, timeZone);
}

export function dateTimeParts(instant: Date, timeZone: string): { date: string; time: string } {
  const local = toZonedTime(instant, timeZone);
  return {
    date: dayKey(instant, timeZone),
    time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
  };
}

export function trailingDaysWindow(reference: Date, days: number, timeZone: string): DateWindow {
  const localEnd = addDays(startOfDay(toZonedTime(reference, timeZone)), 1);
  return {
    from: fromZonedTime(addDays(localEnd, -days), timeZone),
    to: fromZonedTime(localEnd, timeZone),
  };
}

export function dayKey(instant: Date, timeZone: string): string {
  const local = toZonedTime(instant, timeZone);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function isSameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  return dayKey(a, timeZone) === dayKey(b, timeZone);
}

export function toIsoWindow(window: DateWindow): { from: string; to: string } {
  return { from: window.from.toISOString(), to: window.to.toISOString() };
}
