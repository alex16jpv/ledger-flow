"use client";

import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import type { BarsSummary } from "./Bars";
import { cn } from "./cn";
import { Readout } from "./Readout";
import { Tooltip, type TooltipAlign } from "./Tooltip";
import { useRovingSlots } from "./useRovingSlots";

export interface ColumnSegment {
  value: number;
  color?: ColorToken | null;
  over?: boolean;
}

export interface Column {
  label: string;
  detail?: string;
  amount?: string;
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

const BUBBLE_ROOM = 22;

function step(key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  return null;
}

const totalOf = (column: Column): number =>
  column.segments.reduce((sum, segment) => sum + segment.value, 0);

function alignFor(index: number, count: number): TooltipAlign {
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "center";
}

export function ColBars({
  columns,
  label,
  height = 110,
  onSelect,
  summary,
  className,
}: ColBarsProps) {
  const available = columns.map((_, index) => index);
  const slots = useRovingSlots(available, step, available.at(-1) ?? null);
  const top = Math.max(0, ...columns.map((column) => Math.max(totalOf(column), column.cap ?? 0)));

  const interactive = onSelect !== undefined;
  const reading = interactive
    ? label
    : `${label}: ${columns.map((column) => column.label).join(", ")}`;
  const pointed = slots.active !== null ? columns[slots.active] : undefined;
  const line = pointed
    ? { label: pointed.detail ?? pointed.label, amount: pointed.amount }
    : summary;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role={interactive ? "group" : "img"}
        aria-label={reading}
        className="flex items-end gap-2"
        style={{ height, marginTop: BUBBLE_ROOM }}
        onKeyDown={interactive ? slots.onKeyDown : undefined}
        onMouseLeave={slots.onMouseLeave}
      >
        {columns.map((column, index) => {
          const share = (value: number) => (top > 0 ? (value / top) * 100 : 0);
          const body = (
            <span className="relative flex h-full w-full flex-col justify-end">
              {column.cap !== undefined && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t-2 border-dashed border-text-3"
                  style={{ bottom: `${String(share(column.cap))}%` }}
                />
              )}
              {column.segments.map((segment, at) => (
                <i
                  key={at}
                  className={cn(
                    "block min-h-[2px] rounded-[2px] opacity-85 transition-opacity duration-(--dur-1) ease-(--ease) group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100",
                    at === 0 && "rounded-t-[3px]",
                    segment.over === true ? "bg-danger" : segment.color ? "bg-(--f)" : "bg-brand",
                    column.partial === true &&
                      "[background-image:repeating-linear-gradient(45deg,transparent_0_3px,var(--surface)_3px_5px)]",
                  )}
                  style={{
                    height: `${String(share(segment.value))}%`,
                    ...featureColorStyle(segment.color),
                  }}
                />
              ))}
            </span>
          );
          const { onMouseEnter, ...roving } = slots.slotProps(index);
          return (
            <Tooltip
              key={index}
              label={column.label}
              align={alignFor(index, columns.length)}
              className="min-w-0 flex-1 self-stretch"
            >
              {interactive ? (
                <button
                  type="button"
                  aria-label={column.label}
                  onClick={() => {
                    onSelect(index);
                  }}
                  onMouseEnter={onMouseEnter}
                  {...roving}
                  className="group/slot flex h-full w-full cursor-pointer items-end"
                >
                  {body}
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  onMouseEnter={onMouseEnter}
                  className="group/slot flex h-full w-full items-end"
                >
                  {body}
                </span>
              )}
            </Tooltip>
          );
        })}
      </div>
      {(summary !== undefined || interactive) && (
        <Readout label={line?.label ?? ""} value={line?.amount} />
      )}
    </div>
  );
}
