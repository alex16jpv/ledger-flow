"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { cn } from "./cn";
import { Readout } from "./Readout";
import { Tooltip, type TooltipAlign } from "./Tooltip";

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
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const slots = useRef(new Map<number, HTMLButtonElement>());

  const happened = bars.flatMap((bar, index) => (bar.future ? [] : [index]));
  const max = Math.max(0, ...happened.map((index) => bars[index]?.value ?? 0));
  const first = happened[0] ?? null;
  const last = happened[happened.length - 1] ?? null;
  const todayIndex = happened.find((index) => bars[index]?.today) ?? null;
  const nearest = (index: number) => happened.findLast((slot) => slot <= index) ?? first;
  const rover =
    entered === null
      ? (todayIndex ?? first)
      : happened.includes(entered)
        ? entered
        : nearest(entered);
  const lostFocus = focused !== null && !happened.includes(focused);

  useEffect(() => {
    if (!lostFocus || rover === null) return;
    slots.current.get(rover)?.focus();
  }, [lostFocus, rover]);

  function move(target: number | null) {
    if (target === null) return;
    setEntered(target);
    slots.current.get(target)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const from = happened.indexOf(rover ?? -1);
    if (from < 0) return;
    const delta = step(event.key);
    const target =
      delta !== null
        ? (happened[Math.min(Math.max(from + delta, 0), happened.length - 1)] ?? null)
        : event.key === "Home"
          ? first
          : event.key === "End"
            ? last
            : undefined;
    if (target === undefined) return;
    event.preventDefault();
    move(target);
  }

  const interactive = onSelect !== undefined;
  const reading = interactive
    ? label
    : `${label}: ${happened.map((index) => bars[index]?.label ?? "").join(", ")}`;
  const active = hovered ?? focused;
  const pointed = active !== null ? bars[active] : undefined;
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
        onKeyDown={interactive ? onKeyDown : undefined}
        onMouseLeave={() => {
          setHovered(null);
        }}
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
                  ref={(node) => {
                    if (node) slots.current.set(index, node);
                    else slots.current.delete(index);
                  }}
                  aria-label={bar.label}
                  tabIndex={index === rover ? 0 : -1}
                  onClick={() => {
                    onSelect(index);
                  }}
                  onFocus={() => {
                    setEntered(index);
                    setFocused(index);
                  }}
                  onBlur={() => {
                    setFocused((current) => (current === index ? null : current));
                  }}
                  onMouseEnter={() => {
                    setHovered(index);
                  }}
                  className="group/slot flex h-full w-full cursor-pointer items-end"
                >
                  {body}
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  onMouseEnter={() => {
                    setHovered(index);
                  }}
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
