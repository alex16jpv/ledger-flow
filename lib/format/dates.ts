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

export function dayKey(instant: Date, timeZone: string): string {
  const local = toZonedTime(instant, timeZone);
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${local.getFullYear()}-${month}-${day}`;
}

export function isSameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  return dayKey(a, timeZone) === dayKey(b, timeZone);
}

export function toIsoWindow(window: DateWindow): { from: string; to: string } {
  return { from: window.from.toISOString(), to: window.to.toISOString() };
}
