"use client";

import type { BarsSummary } from "./Bars";
import { cn } from "./cn";
import { Readout } from "./Readout";
import { Tooltip, type TooltipAlign } from "./Tooltip";
import { useRovingSlots } from "./useRovingSlots";

export interface Pair {
  label: string;
  detail?: string;
  amount?: string;
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

const BUBBLE_ROOM = 22;

const BAR =
  "block min-h-[3px] w-[11px] rounded-t-[3px] rounded-b-[1px] opacity-80 transition-opacity duration-(--dur-1) ease-(--ease) group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100";

function step(key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  return null;
}

function alignFor(index: number, count: number): TooltipAlign {
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "center";
}

export function GBars({ pairs, label, height = 128, onSelect, summary, className }: GBarsProps) {
  const available = pairs.map((_, index) => index);
  const slots = useRovingSlots(available, step, available.at(-1) ?? null);
  const top = Math.max(0, ...pairs.flatMap((pair) => [pair.income, pair.spending]));

  const interactive = onSelect !== undefined;
  const reading = interactive ? label : `${label}: ${pairs.map((pair) => pair.label).join(", ")}`;
  const pointed = slots.active !== null ? pairs[slots.active] : undefined;
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
        {pairs.map((pair, index) => {
          const share = (value: number) => (top > 0 ? (value / top) * 100 : 0);
          const paint = cn(
            BAR,
            pair.partial === true &&
              "[background-image:repeating-linear-gradient(45deg,transparent_0_3px,var(--surface)_3px_5px)]",
          );
          const body = (
            <span className="flex h-full w-full items-end justify-center gap-[3px]">
              <i
                className={cn(paint, "bg-income")}
                style={{ height: `${String(share(pair.income))}%` }}
              />
              <i
                className={cn(paint, "bg-brand")}
                style={{ height: `${String(share(pair.spending))}%` }}
              />
            </span>
          );
          const { onMouseEnter, ...roving } = slots.slotProps(index);
          return (
            <Tooltip
              key={index}
              label={pair.label}
              align={alignFor(index, pairs.length)}
              className="min-w-0 flex-1 self-stretch"
            >
              {interactive ? (
                <button
                  type="button"
                  aria-label={pair.label}
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
