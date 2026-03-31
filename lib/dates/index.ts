import { format, isValid, parse, parseISO, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const APP_TIMEZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "America/Mexico_City";

export const DATE_FORMATS = {
  iso: "yyyy-MM-dd",
  display: "MMMM d, yyyy",
  monthYear: "MMMM yyyy",
  shortDateYear: "MMM d, yyyy",
  shortDate: "MMM d",
  dayShortMonth: "dd MMM",
  monthLong: "MMMM",
  time: "HH:mm",
  dayShortMonthTime: "dd MMM · HH:mm",
} as const;

export type DateFormat = keyof typeof DATE_FORMATS;
export type DateInput = Date | string | number;

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function toDate(input: DateInput): Date {
  let raw: Date;

  if (input instanceof Date) {
    raw = input;
  } else if (typeof input === "string") {
    raw = parseISO(input);
  } else {
    raw = new Date(input);
  }

  if (!isValid(raw)) {
    throw new RangeError(`Invalid date input: ${String(input)}`);
  }

  return toZonedTime(raw, APP_TIMEZONE);
}

export function formatDate(
  input: DateInput,
  formatKey: DateFormat = "display",
): string {
  return format(toDate(input), DATE_FORMATS[formatKey]);
}

export function formatDateCustom(input: DateInput, pattern: string): string {
  return format(toDate(input), pattern);
}

export function toISODate(input: DateInput): string {
  return format(toDate(input), DATE_FORMATS.iso);
}

// ---------------------------------------------------------------------------
// Time-only utilities
// ---------------------------------------------------------------------------

/**
 * Formats to "HH:mm".
 * Accepts a full Date / DateInput OR a time-only string like "09:00" / "14:30".
 */
export function formatTime(input: DateInput): string {
  if (typeof input === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input)) {
    return input;
  }
  return format(toDate(input), DATE_FORMATS.time);
}

export function formatDuration(minutes: number): string {
  if (minutes < 0) {
    throw new RangeError(
      `formatDuration expects a non-negative number, got ${minutes}`,
    );
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ---------------------------------------------------------------------------
// Project-specific utilities
// ---------------------------------------------------------------------------

export function getCurrentDate(): string {
  return toISODate(new Date());
}

export function getCurrentTime(): string {
  return formatTime(new Date());
}

/**
 * Returns both date (ISO) and time (HH:mm) from a single Date snapshot,
 * avoiding drift that can occur when calling getCurrentDate/getCurrentTime
 * separately (e.g. around midnight).
 */
export function getCurrentDateTime(): { date: string; time: string } {
  const now = new Date();
  return { date: toISODate(now), time: formatTime(now) };
}

export function getCurrentMonthName(): string {
  return formatDate(new Date(), "monthLong");
}

export function parseDateTimeFields(date: string, time: string): Date {
  const timePart = time || "00:00";
  const raw = parse(`${date} ${timePart}`, "yyyy-MM-dd HH:mm", new Date());
  if (!isValid(raw)) {
    throw new RangeError(
      `Invalid date/time fields: date="${date}", time="${time}"`,
    );
  }
  return toZonedTime(raw, APP_TIMEZONE);
}

export function getDateGroupLabel(input: DateInput): string {
  const date = toDate(input);
  const now = toDate(new Date());

  const dateDay = format(date, DATE_FORMATS.iso);
  const nowDay = format(now, DATE_FORMATS.iso);
  const yesterdayDay = format(subDays(now, 1), DATE_FORMATS.iso);

  const dateStr = formatDate(date, "shortDate");

  if (dateDay === nowDay) return `Today — ${dateStr}`;
  if (dateDay === yesterdayDay) return `Yesterday — ${dateStr}`;
  return dateStr;
}

export function getDateGroupKey(input: DateInput): string {
  return toISODate(input);
}
