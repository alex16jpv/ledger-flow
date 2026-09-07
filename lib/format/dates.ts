import {
  addDays,
  addMonths,
  addYears,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
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

export function weekWindow(reference: Date, timeZone: string): DateWindow {
  const localStart = startOfWeek(toZonedTime(reference, timeZone), { weekStartsOn: 1 });
  return {
    from: fromZonedTime(localStart, timeZone),
    to: fromZonedTime(addDays(localStart, 7), timeZone),
  };
}

export function yearWindow(reference: Date, timeZone: string): DateWindow {
  const localStart = startOfYear(toZonedTime(reference, timeZone));
  return {
    from: fromZonedTime(localStart, timeZone),
    to: fromZonedTime(addYears(localStart, 1), timeZone),
  };
}

// Inclusive calendar days from a date form: [from 00:00, to 00:00 + 1 day).
export function daysWindow(fromDate: string, toDate: string, timeZone: string): DateWindow {
  return {
    from: fromZonedTime(`${fromDate}T00:00:00`, timeZone),
    to: addDays(fromZonedTime(`${toDate}T00:00:00`, timeZone), 1),
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

// Day arithmetic on the key itself. A calendar day has no zone of its own, so moving one must not
// go through an instant: "the day after 2026-09-30" is 2026-10-01 wherever the user is.
export function shiftDayKey(day: string, days: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + days));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
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
