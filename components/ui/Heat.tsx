"use client";

import { WEEK_LENGTH } from "@/lib/charts/days";

import type { BarsSummary } from "./Bars";
import { cn } from "./cn";
import { Readout } from "./Readout";
import { Tooltip, type TooltipAlign } from "./Tooltip";
import { useCanHover } from "./useCanHover";
import { useRovingSlots } from "./useRovingSlots";

export interface HeatCell {
  value: number;
  text: string;
  label: string;
  detail?: string;
  amount?: string;
  today?: boolean;
  future?: boolean;
}

export interface HeatScale {
  less: string;
  more: string;
}

export interface HeatProps {
  cells: readonly HeatCell[];
  columns: readonly string[];
  leading: number;
  label: string;
  scale: HeatScale;
  onSelect?: (index: number) => void;
  summary?: BarsSummary;
  className?: string;
}

// Four steps, because a scale a reader has to measure against a gradient is not a scale.
const STEPS = [
  "bg-heat-1 text-text",
  "bg-heat-2 text-text",
  "bg-heat-3 text-text",
  "bg-heat-4 text-on-brand",
];

function level(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "bg-surface-3 text-text-3";
  const share = value / max;
  const index = share > 0.75 ? 3 : share > 0.5 ? 2 : share > 0.25 ? 1 : 0;
  return STEPS[index] ?? "bg-surface-3 text-text-3";
}

function step(key: string): number | null {
  if (key === "ArrowRight") return 1;
  if (key === "ArrowLeft") return -1;
  if (key === "ArrowDown") return WEEK_LENGTH;
  if (key === "ArrowUp") return -WEEK_LENGTH;
  return null;
}

function alignFor(column: number): TooltipAlign {
  if (column === 0) return "start";
  if (column === WEEK_LENGTH - 1) return "end";
  return "center";
}

export function Heat({
  cells,
  columns,
  leading,
  label,
  scale,
  onSelect,
  summary,
  className,
}: HeatProps) {
  const happened = cells.flatMap((cell, index) => (cell.future ? [] : [index]));
  const max = Math.max(0, ...happened.map((index) => cells[index]?.value ?? 0));
  const today = happened.find((index) => cells[index]?.today) ?? null;
  const slots = useRovingSlots(happened, step, today);

  const interactive = onSelect !== undefined;
  const opens = useCanHover() ? onSelect : undefined;
  const reading = interactive
    ? label
    : `${label}: ${happened.map((index) => cells[index]?.label ?? "").join(", ")}`;
  const pointed = slots.active !== null ? cells[slots.active] : undefined;
  const line = pointed
    ? { label: pointed.detail ?? pointed.label, amount: pointed.amount }
    : summary;

  return (
    // A cell is a square, so on a wide card the month would grow into seven columns of tiles.
    <div className={cn("mx-auto flex w-full max-w-[392px] flex-col gap-2", className)}>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-xs text-text-3">
        {columns.map((name, column) => (
          <span key={column} className="text-center">
            {name}
          </span>
        ))}
      </div>
      <div
        role={interactive ? "group" : "img"}
        aria-label={reading}
        className="grid grid-cols-7 gap-1"
        onKeyDown={interactive ? slots.onKeyDown : undefined}
        onMouseLeave={slots.onMouseLeave}
      >
        {Array.from({ length: leading }, (_, pad) => (
          <span key={`pad-${String(pad)}`} aria-hidden="true" className="aspect-square" />
        ))}
        {cells.map((cell, index) => {
          const column = (leading + index) % WEEK_LENGTH;
          const shell = cn(
            "grid aspect-square min-h-[26px] w-full place-items-center rounded-[5px] text-xs tabular-nums",
            cell.today && "ring-2 ring-border-strong ring-offset-2 ring-offset-surface",
          );
          if (cell.future)
            return (
              <span
                key={index}
                aria-hidden="true"
                className={cn(shell, "text-text-3 inset-ring inset-ring-text-3")}
              >
                {cell.text}
              </span>
            );
          const { onMouseEnter, ...roving } = slots.slotProps(index);
          const paint = cn(shell, level(cell.value, max));
          return (
            <Tooltip key={index} label={cell.label} align={alignFor(column)} className="w-full">
              {onSelect ? (
                <button
                  type="button"
                  aria-label={cell.label}
                  onClick={
                    opens
                      ? () => {
                          opens(index);
                        }
                      : undefined
                  }
                  onMouseEnter={onMouseEnter}
                  {...roving}
                  className={cn(paint, "cursor-pointer")}
                >
                  {cell.text}
                </button>
              ) : (
                <span aria-hidden="true" onMouseEnter={onMouseEnter} className={paint}>
                  {cell.text}
                </span>
              )}
            </Tooltip>
          );
        })}
      </div>
      <div aria-hidden="true" className="flex items-center gap-1 text-xs text-text-3">
        <span>{scale.less}</span>
        <i className="block size-3 rounded-[3px] bg-surface-3" />
        <i className="block size-3 rounded-[3px] bg-heat-1" />
        <i className="block size-3 rounded-[3px] bg-heat-2" />
        <i className="block size-3 rounded-[3px] bg-heat-3" />
        <i className="block size-3 rounded-[3px] bg-heat-4" />
        <span>{scale.more}</span>
      </div>
      <Readout label={line?.label ?? ""} value={line?.amount} />
    </div>
  );
}
