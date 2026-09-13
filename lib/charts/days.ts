import { weekdayOf } from "@/lib/format/dates";

export interface DaySlot {
  key: string;
  value: number;
  count?: number;
  today?: boolean;
  future?: boolean;
}

export const WEEK_LENGTH = 7;

export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DEFAULT_WEEK_START: IsoWeekday = 1;

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay?: number };
  weekInfo?: { firstDay?: number };
}

// Intl.Locale.getWeekInfo is not in every engine yet, and some expose the same answer as a property.
export function weekStartFor(locale: string): IsoWeekday {
  try {
    const resolved = new Intl.Locale(locale) as Intl.Locale & WeekInfoLocale;
    const firstDay = resolved.getWeekInfo?.().firstDay ?? resolved.weekInfo?.firstDay;
    if (typeof firstDay === "number" && firstDay >= 1 && firstDay <= WEEK_LENGTH) {
      return firstDay as IsoWeekday;
    }
  } catch {
    return DEFAULT_WEEK_START;
  }
  return DEFAULT_WEEK_START;
}

// Intl counts Monday as 1 and Sunday as 7; Date counts Sunday as 0.
export function isoWeekday(dayKey: string): IsoWeekday {
  const weekday = weekdayOf(dayKey);
  return (weekday === 0 ? WEEK_LENGTH : weekday) as IsoWeekday;
}

export function weekColumn(dayKey: string, weekStart: IsoWeekday): number {
  return (isoWeekday(dayKey) - weekStart + WEEK_LENGTH) % WEEK_LENGTH;
}

export function weekColumns(weekStart: IsoWeekday): IsoWeekday[] {
  return Array.from(
    { length: WEEK_LENGTH },
    (_, offset) => (((weekStart - 1 + offset) % WEEK_LENGTH) + 1) as IsoWeekday,
  );
}

export function calendarLeading(firstDayKey: string | undefined, weekStart: IsoWeekday): number {
  return firstDayKey === undefined ? 0 : weekColumn(firstDayKey, weekStart);
}
