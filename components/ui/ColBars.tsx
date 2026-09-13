"use client";

import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import type { BarsSummary } from "./Bars";
import { type ChartSlot, ChartSlots, HATCH } from "./ChartSlots";
import { cn } from "./cn";

export interface ColumnSegment {
  value: number;
  color?: ColorToken | null;
  over?: boolean;
}

export interface Column extends ChartSlot {
  segments: readonly ColumnSegment[];
  cap?: number;
  // A period still running is hatched and counts towards nothing the line underneath claims.
  partial?: boolean;
}

export interface ColBarsProps {
  columns: readonly Column[];
  label: string;
  height?: number;
  onSelect?: (index: number) => void;
  summary?: BarsSummary;
  className?: string;
}

const SEGMENT =
  "block min-h-[2px] rounded-[2px] opacity-85 transition-opacity duration-(--dur-1) ease-(--ease) group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100";

const totalOf = (column: Column): number =>
  column.segments.reduce((sum, segment) => sum + segment.value, 0);

export function ColBars({
  columns,
  label,
  height = 110,
  onSelect,
  summary,
  className,
}: ColBarsProps) {
  const top = Math.max(0, ...columns.map((column) => Math.max(totalOf(column), column.cap ?? 0)));
  const share = (value: number) => (top > 0 ? (value / top) * 100 : 0);

  return (
    <ChartSlots
      slots={columns}
      label={label}
      height={height}
      onSelect={onSelect}
      summary={summary}
      className={className}
    >
      {(index) => {
        const column = columns[index];
        if (!column) return null;
        return (
          <span className="relative flex h-full w-full flex-col justify-end">
            {column.cap !== undefined && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 border-t-2 border-dashed border-text-3"
                style={{ bottom: `${String(share(column.cap))}%` }}
              />
            )}
            {column.segments.length === 0 && (
              <i
                className={cn(SEGMENT, "rounded-t-[3px] bg-surface-3")}
                style={{ height: "2px" }}
              />
            )}
            {column.segments.map((segment, at) => (
              <i
                key={at}
                className={cn(
                  SEGMENT,
                  at === 0 && "rounded-t-[3px]",
                  segment.over === true ? "bg-danger" : segment.color ? "bg-(--f)" : "bg-brand",
                  column.partial === true && HATCH,
                )}
                style={{
                  height: `${String(share(segment.value))}%`,
                  ...featureColorStyle(segment.color),
                }}
              />
            ))}
          </span>
        );
      }}
    </ChartSlots>
  );
}
