"use client";

import type { ReactNode } from "react";

import type { BarsSummary } from "./Bars";
import { cn } from "./cn";
import { Readout } from "./Readout";
import { useSlotOpen } from "./slotOpen";
import { Tooltip, type TooltipAlign } from "./Tooltip";
import { useRovingSlots } from "./useRovingSlots";

export interface ChartSlot {
  label: string;
  detail?: string;
  amount?: string;
}

export interface ChartSlotsProps {
  slots: readonly ChartSlot[];
  label: string;
  height: number;
  onSelect?: (index: number) => void;
  summary?: BarsSummary;
  className?: string;
  children: (index: number) => ReactNode;
}

// The bubble's own height, kept clear above the tallest slot so it never covers the card's title.
export const BUBBLE_ROOM = 22;

// A period still running is hatched: the same reading in every chart that has one.
export const HATCH =
  "[background-image:repeating-linear-gradient(45deg,transparent_0_3px,var(--surface)_3px_5px)]";

function step(key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  return null;
}

export function alignFor(index: number, count: number): TooltipAlign {
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "center";
}

// F-90 · one chart is one tab stop, one slot is one control, and the line underneath is its reading.
export function ChartSlots({
  slots,
  label,
  height,
  onSelect,
  summary,
  className,
  children,
}: ChartSlotsProps) {
  const available = slots.map((_, index) => index);
  const roving = useRovingSlots(available, step, available.at(-1) ?? null);

  const interactive = onSelect !== undefined;
  const open = useSlotOpen(onSelect);
  const reading = interactive ? label : `${label}: ${slots.map((slot) => slot.label).join(", ")}`;
  const pointed = roving.active !== null ? slots[roving.active] : undefined;
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
        onKeyDown={interactive ? roving.onKeyDown : undefined}
        onMouseLeave={roving.onMouseLeave}
      >
        {slots.map((slot, index) => {
          const { onMouseEnter, ...rest } = roving.slotProps(index);
          return (
            <Tooltip
              key={index}
              label={slot.label}
              align={alignFor(index, slots.length)}
              className="min-w-0 flex-1 self-stretch"
            >
              {interactive ? (
                <button
                  type="button"
                  aria-label={slot.label}
                  onClick={open?.(index)}
                  onMouseEnter={onMouseEnter}
                  {...rest}
                  className="group/slot flex h-full w-full cursor-pointer items-end"
                >
                  {children(index)}
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  onMouseEnter={onMouseEnter}
                  className="group/slot flex h-full w-full items-end"
                >
                  {children(index)}
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
