"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import type { DaySlot, IsoWeekday } from "@/lib/charts/days";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";

export interface DayReading {
  label: string;
  detail: string;
  amount: string;
  dayOfMonth: string;
}

// F-90: one place turns a day key into what a slot says, so every chart of days reads the same.
export function useDayReading(): (day: DaySlot) => DayReading {
  const t = useTranslations("charts");
  const dates = useDates();
  const money = useMoney();
  return useCallback(
    (day: DaySlot) => {
      const when = dates.fromDayKey(day.key);
      const long = dates.formatLong(when);
      const amount = money.format(day.value);
      return {
        label: t("daySlot", { day: dates.formatWeekdayDayShort(when), amount }),
        detail: day.count === undefined ? long : t("dayDetail", { day: long, count: day.count }),
        amount,
        dayOfMonth: dates.formatDayOfMonth(when),
      };
    },
    [t, dates, money],
  );
}

export interface WeekdayNames {
  long: (weekday: IsoWeekday) => string;
  short: (weekday: IsoWeekday) => string;
}

// 2024-01-01 is a Monday, so ISO weekday n is that many days on from it in plain UTC.
const weekdayDate = (weekday: IsoWeekday) => new Date(Date.UTC(2024, 0, weekday));

export function useWeekdayNames(): WeekdayNames {
  const { formatLocale } = useFormatSettings();
  return useMemo(() => {
    const format = (weekday: Intl.DateTimeFormatOptions["weekday"]) =>
      new Intl.DateTimeFormat(formatLocale, { weekday, timeZone: "UTC" });
    const long = format("long");
    const short = format("short");
    return {
      long: (weekday) => long.format(weekdayDate(weekday)),
      short: (weekday) => short.format(weekdayDate(weekday)),
    };
  }, [formatLocale]);
}
