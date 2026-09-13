export interface DateWindow {
  from: Date;
  to: Date;
}

function localDayStart(day: string, timeZone: string): Date {
  return instantOf(`${day}T00:00:00`, timeZone);
}

// Windows are half-open [from, to) and computed in the user's zone, then expressed as UTC instants.
export function monthWindow(reference: Date, timeZone: string): DateWindow {
  const first = `${dayKey(reference, timeZone).slice(0, 7)}-01`;
  return {
    from: localDayStart(first, timeZone),
    to: localDayStart(shiftDayKeyMonths(first, 1), timeZone),
  };
}

export function weekWindow(reference: Date, timeZone: string): DateWindow {
  const day = dayKey(reference, timeZone);
  const start = shiftDayKey(day, -((weekdayOf(day) + 6) % 7));
  return {
    from: localDayStart(start, timeZone),
    to: localDayStart(shiftDayKey(start, 7), timeZone),
  };
}

export function yearWindow(reference: Date, timeZone: string): DateWindow {
  const year = Number(dayKey(reference, timeZone).slice(0, 4));
  return {
    from: localDayStart(`${year}-01-01`, timeZone),
    to: localDayStart(`${year + 1}-01-01`, timeZone),
  };
}

// Inclusive calendar days from a date form: [from 00:00, to 00:00 + 1 day).
export function daysWindow(fromDate: string, toDate: string, timeZone: string): DateWindow {
  return {
    from: localDayStart(fromDate, timeZone),
    to: localDayStart(shiftDayKey(toDate, 1), timeZone),
  };
}

export function dayWindow(reference: Date, timeZone: string): DateWindow {
  const day = dayKey(reference, timeZone);
  return {
    from: localDayStart(day, timeZone),
    to: localDayStart(shiftDayKey(day, 1), timeZone),
  };
}

export function shiftMonth(reference: Date, months: number, timeZone: string): Date {
  const { date, time } = dateTimeParts(reference, timeZone);
  return localDateTime(shiftDayKeyMonths(date, months), time, timeZone);
}

export function localNoon(isoDate: string, timeZone: string): Date {
  return instantOf(`${isoDate}T12:00:00`, timeZone);
}

export function localDateTime(isoDate: string, time: string, timeZone: string): Date {
  return instantOf(`${isoDate}T${time}:00`, timeZone);
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
  const local = wallClock(instant, timeZone);
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
  };
}

export function trailingDaysWindow(reference: Date, days: number, timeZone: string): DateWindow {
  const end = shiftDayKey(dayKey(reference, timeZone), 1);
  return {
    from: localDayStart(shiftDayKey(end, -days), timeZone),
    to: localDayStart(end, timeZone),
  };
}

// A calendar day has no zone, so moving one must not go through an instant.
export function shiftDayKey(day: string, days: number): string {
  const { year, month, date } = dayParts(day);
  return dayKeyOf(new Date(Date.UTC(year, month, date + days)));
}

export function shiftDayKeyMonths(day: string, months: number): string {
  const { year, month, date } = dayParts(day);
  const first = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return dayKeyOf(
    new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date, lastDay))),
  );
}

function weekdayOf(day: string): number {
  const { year, month, date } = dayParts(day);
  return new Date(Date.UTC(year, month, date)).getUTCDay();
}

function dayParts(day: string): { year: number; month: number; date: number } {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return { year, month: month - 1, date };
}

function dayKeyOf(utc: Date): string {
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export function dayKey(instant: Date, timeZone: string): string {
  return wallClock(instant, timeZone).slice(0, 10);
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const known = FORMATTERS.get(timeZone);
  if (known) return known;
  const made = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  FORMATTERS.set(timeZone, made);
  return made;
}

// The only reading of a zone in this file: Intl asks the zone itself, where a Date would ask the device.
function wallClock(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const year = value("year").padStart(4, "0");
  return `${year}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}

function asUtcMs(wall: string): number {
  const [year = 0, month = 1, date = 1] = wall.slice(0, 10).split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = wall.slice(11).split(":").map(Number);
  return Date.UTC(year, month - 1, date, hour, minute, second);
}

function offsetMsAt(ms: number, timeZone: string): number {
  return asUtcMs(wallClock(new Date(ms), timeZone)) - ms;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// A wall clock can name two instants or none: the repeated hour reads as the first, the skipped one forward.
function instantOf(wall: string, timeZone: string): Date {
  const target = asUtcMs(wall);
  const sides = [
    target - offsetMsAt(target - DAY_MS, timeZone),
    target - offsetMsAt(target + DAY_MS, timeZone),
  ];
  const real = sides.filter((ms) => asUtcMs(wallClock(new Date(ms), timeZone)) === target);
  return new Date(real.length > 0 ? Math.min(...real) : Math.max(...sides));
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
