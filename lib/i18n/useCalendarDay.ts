"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";

import { formatCalendarDay } from "@/lib/format/dates";

import { formatLocaleFor } from "./format-locale";
import { isAppLocale } from "./routing";

export function useCalendarDay(): (day: string, withYear?: boolean) => string {
  const locale = useLocale();
  const formatLocale = formatLocaleFor(isAppLocale(locale) ? locale : "en");
  return useCallback(
    (day: string, withYear = true) => formatCalendarDay(day, formatLocale, withYear),
    [formatLocale],
  );
}
