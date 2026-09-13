"use client";

import type { BarsSummary } from "./Bars";
import { type ChartSlot, ChartSlots, HATCH } from "./ChartSlots";
import { cn } from "./cn";

export interface Pair extends ChartSlot {
  income: number;
  spending: number;
  // A period still running is hatched and counts towards nothing the line underneath claims.
  partial?: boolean;
}

export interface GBarsProps {
  pairs: readonly Pair[];
  label: string;
  height?: number;
  onSelect?: (index: number) => void;
  summary?: BarsSummary;
  className?: string;
}

const BAR =
  "block min-h-[3px] w-[11px] rounded-t-[3px] rounded-b-[1px] opacity-80 transition-opacity duration-(--dur-1) ease-(--ease) group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100";
const INCOME = "bg-income";
const SPENDING = "bg-brand";
// A month with nothing in it reads as the empty track, exactly as a day with nothing does.
const NOTHING = "bg-surface-3";

export function GBars({ pairs, label, height = 128, onSelect, summary, className }: GBarsProps) {
  const top = Math.max(0, ...pairs.flatMap((pair) => [pair.income, pair.spending]));
  const share = (value: number) => (top > 0 ? (value / top) * 100 : 0);

  return (
    <ChartSlots
      slots={pairs}
      label={label}
      height={height}
      onSelect={onSelect}
      summary={summary}
      className={className}
    >
      {(index) => {
        const pair = pairs[index];
        if (!pair) return null;
        const bar = (value: number, paint: string) => (
          <i
            className={cn(BAR, value > 0 ? paint : NOTHING, pair.partial === true && HATCH)}
            style={{ height: `${String(share(value))}%` }}
          />
        );
        return (
          <span className="flex h-full w-full items-end justify-center gap-[3px]">
            {bar(pair.income, INCOME)}
            {bar(pair.spending, SPENDING)}
          </span>
        );
      }}
    </ChartSlots>
  );
}
