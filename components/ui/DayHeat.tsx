"use client";

import { useTranslations } from "next-intl";

import { calendarLeading, type DaySlot, weekColumns, weekStartFor } from "@/lib/charts/days";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";

import type { BarsSummary } from "./Bars";
import { useDayReading, useWeekdayNames } from "./dayReading";
import { Heat, type HeatCell } from "./Heat";

export interface DayHeatProps {
  days: readonly DaySlot[];
  label: string;
  onOpen?: (key: string) => void;
  summary?: BarsSummary;
  className?: string;
}

export function DayHeat({ days, label, onOpen, summary, className }: DayHeatProps) {
  const t = useTranslations("charts");
  const { formatLocale } = useFormatSettings();
  const reading = useDayReading();
  const weekdays = useWeekdayNames();
  const weekStart = weekStartFor(formatLocale);
  const columns = weekColumns(weekStart).map(weekdays.short);
  const cells: HeatCell[] = days.map((day) => {
    const { dayOfMonth, ...slot } = reading(day);
    return { value: day.value, text: dayOfMonth, ...slot, today: day.today, future: day.future };
  });
  const select = onOpen
    ? (index: number) => {
        const key = days[index]?.key;
        if (key !== undefined) onOpen(key);
      }
    : undefined;
  return (
    <Heat
      cells={cells}
      columns={columns}
      leading={calendarLeading(days[0]?.key, weekStart)}
      label={label}
      scale={{ less: t("less"), more: t("more") }}
      summary={summary}
      className={className}
      onSelect={select}
    />
  );
}
