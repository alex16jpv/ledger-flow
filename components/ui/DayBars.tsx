"use client";

import { useMemo } from "react";

import type { DaySlot } from "@/lib/charts/days";

import { type Bar, Bars, type BarsSummary } from "./Bars";
import { useDayReading } from "./dayReading";

export interface DayBarsProps {
  days: readonly DaySlot[];
  label: string;
  height?: number;
  onOpen?: (key: string) => void;
  summary?: BarsSummary;
  className?: string;
}

export function DayBars({ days, label, height, onOpen, summary, className }: DayBarsProps) {
  const reading = useDayReading();
  const bars = useMemo<Bar[]>(
    () =>
      days.map((day) => ({
        value: day.value,
        ...reading(day),
        today: day.today,
        future: day.future,
      })),
    [days, reading],
  );
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
