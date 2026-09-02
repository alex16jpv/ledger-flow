"use client";

import { useMemo } from "react";

import { dayKey, dayWindow, isSameLocalDay, monthWindow, shiftMonth } from "@/lib/format/dates";

import { useFormatSettings } from "./FormatSettingsProvider";

export function useDates() {
  const { formatLocale, timeZone } = useFormatSettings();
  return useMemo(() => {
    const dateTime = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(formatLocale, { timeZone, ...options });
    return {
      timeZone,
      formatLong: (date: Date) =>
        dateTime({ weekday: "long", month: "long", day: "numeric" }).format(date),
      formatMonth: (date: Date) => dateTime({ month: "long", year: "numeric" }).format(date),
      formatDay: (date: Date) => dateTime({ month: "short", day: "numeric" }).format(date),
      formatTime: (date: Date) => dateTime({ hour: "numeric", minute: "2-digit" }).format(date),
      monthWindow: (reference: Date) => monthWindow(reference, timeZone),
      dayWindow: (reference: Date) => dayWindow(reference, timeZone),
      shiftMonth: (reference: Date, months: number) => shiftMonth(reference, months, timeZone),
      dayKey: (date: Date) => dayKey(date, timeZone),
      isSameDay: (a: Date, b: Date) => isSameLocalDay(a, b, timeZone),
    };
  }, [formatLocale, timeZone]);
}
