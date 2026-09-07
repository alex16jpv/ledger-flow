"use client";

import { useMemo } from "react";

import { dayKey, dayWindow, isSameLocalDay, monthWindow, shiftMonth } from "@/lib/format/dates";

import { useFormatSettings } from "./FormatSettingsProvider";

export function useDates() {
  const { formatLocale, timeZone } = useFormatSettings();
  return useMemo(() => {
    const dateTime = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(formatLocale, { timeZone, ...options });
    // Spanish month names are lowercase; as a standalone heading ("agosto de 2026") they read better capitalized.
    const capitalize = (text: string) =>
      text.charAt(0).toLocaleUpperCase(formatLocale) + text.slice(1);
    return {
      timeZone,
      formatLong: (date: Date) =>
        dateTime({ weekday: "long", month: "long", day: "numeric" }).format(date),
      formatMonth: (date: Date) =>
        capitalize(dateTime({ month: "long", year: "numeric" }).format(date)),
      formatDay: (date: Date) => dateTime({ month: "short", day: "numeric" }).format(date),
      formatWeekdayDay: (date: Date) =>
        `${dateTime({ weekday: "long" }).format(date)} ${dateTime({ day: "numeric" }).format(date)}`,
      formatRange: (from: Date, to: Date) =>
        dateTime({ month: "short", day: "numeric" }).formatRange(from, to),
      formatTime: (date: Date) => dateTime({ hour: "numeric", minute: "2-digit" }).format(date),
      monthWindow: (reference: Date) => monthWindow(reference, timeZone),
      dayWindow: (reference: Date) => dayWindow(reference, timeZone),
      shiftMonth: (reference: Date, months: number) => shiftMonth(reference, months, timeZone),
      dayKey: (date: Date) => dayKey(date, timeZone),
      isSameDay: (a: Date, b: Date) => isSameLocalDay(a, b, timeZone),
    };
  }, [formatLocale, timeZone]);
}
