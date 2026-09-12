"use client";

import { useTranslations } from "next-intl";

import type { DaySlot } from "@/lib/charts/days";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";

import { type Bar, Bars, type BarsSummary } from "./Bars";

export interface DayBarsProps {
  days: readonly DaySlot[];
  label: string;
  height?: number;
  onOpen?: (key: string) => void;
  summary?: BarsSummary;
  className?: string;
}

export function DayBars({ days, label, height, onOpen, summary, className }: DayBarsProps) {
  const t = useTranslations("charts");
  const dates = useDates();
  const money = useMoney();
  const bars: Bar[] = days.map((day) => {
    const when = dates.fromDayKey(day.key);
    const long = dates.formatLong(when);
    const amount = money.format(day.value);
    return {
      value: day.value,
      label: t("daySlot", { day: dates.formatWeekdayDayShort(when), amount }),
      detail: day.count === undefined ? long : t("dayDetail", { day: long, count: day.count }),
      amount,
      today: day.today,
      future: day.future,
    };
  });
  const select = onOpen
    ? (index: number) => {
        const key = days[index]?.key;
        if (key !== undefined) onOpen(key);
      }
    : undefined;
  return (
    <Bars
      bars={bars}
      label={label}
      height={height}
      summary={summary}
      className={className}
      onSelect={select}
    />
  );
}
