"use client";

import { cn } from "./cn";
import { Readout } from "./Readout";
import { Tooltip, type TooltipAlign } from "./Tooltip";
import { useRovingSlots } from "./useRovingSlots";

export interface Bar {
  value: number;
  label: string;
  detail?: string;
  amount?: string;
  today?: boolean;
  future?: boolean;
}

export interface BarsSummary {
  label: string;
  amount?: string;
}

export interface BarsProps {
  bars: readonly Bar[];
  label: string;
  height?: number;
  onSelect?: (index: number) => void;
  summary?: BarsSummary;
  className?: string;
}

// The bubble's own height, kept clear above the tallest bar so it never covers the card's title.
const BUBBLE_ROOM = 22;
// The bubble's width is unknown until it paints, so a slot this near an end aligns to it instead.
const EDGE = 0.15;

function step(key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  return null;
}

export function Bars({ bars, label, height = 56, onSelect, summary, className }: BarsProps) {
  const happened = bars.flatMap((bar, index) => (bar.future ? [] : [index]));
  const max = Math.max(0, ...happened.map((index) => bars[index]?.value ?? 0));
  const today = happened.find((index) => bars[index]?.today) ?? null;
  const slots = useRovingSlots(happened, step, today);

  const interactive = onSelect !== undefined;
  const reading = interactive
    ? label
    : `${label}: ${happened.map((index) => bars[index]?.label ?? "").join(", ")}`;
  const pointed = slots.active !== null ? bars[slots.active] : undefined;
  const line = pointed
    ? { label: pointed.detail ?? pointed.label, amount: pointed.amount }
    : summary;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        // Buttons inside an image role are nested interactives for axe: a selectable chart is a group.
        role={interactive ? "group" : "img"}
        aria-label={reading}
        className="flex items-end gap-1"
        style={{ height, marginTop: BUBBLE_ROOM }}
        onKeyDown={interactive ? slots.onKeyDown : undefined}
        onMouseLeave={slots.onMouseLeave}
      >
        {bars.map((bar, index) => {
          if (bar.future)
            return (
              <span key={index} aria-hidden="true" className="flex-1 self-end">
                <i className="block h-px w-full bg-text-3" />
              </span>
            );
          const ratio = max > 0 ? bar.value / max : 0;
          const fill = cn(
            "block min-h-[3px] w-full rounded-t-[3px] rounded-b-px transition-opacity duration-(--dur-1) ease-(--ease)",
            bar.value === 0 ? "bg-surface-3" : "bg-brand",
            bar.value > 0 &&
              !bar.today &&
              ratio < 1 &&
              "opacity-35 group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100",
          );
          const style = { height: `${Math.max(ratio * 100, 2)}%` };
          const place = index / Math.max(bars.length - 1, 1);
          const align: TooltipAlign = place < EDGE ? "start" : place > 1 - EDGE ? "end" : "center";
          const body = <i className={fill} style={style} />;
          const { onMouseEnter, ...roving } = slots.slotProps(index);
          return (
            <Tooltip
              key={index}
              label={bar.label}
              align={align}
              className="min-w-0 flex-1 self-stretch"
            >
              {interactive ? (
                <button
                  type="button"
                  aria-label={bar.label}
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
