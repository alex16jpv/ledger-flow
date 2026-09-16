"use client";

import { type PointerEvent, useRef, useState } from "react";

import { BUBBLE_ROOM, type ChartSlot } from "./ChartSlots";
import { cn } from "./cn";
import { Readout } from "./Readout";
import { BUBBLE } from "./Tooltip";

export type TrendTone = "spent" | "over" | "pace" | "projection";

export interface TrendLine {
  points: readonly (number | null)[];
  tone: TrendTone;
  dot?: boolean;
}

export interface TrendProps {
  lines: readonly TrendLine[];
  label: string;
  limit?: number;
  height?: number;
  points?: readonly (ChartSlot | null)[];
  className?: string;
}

const WIDTH = 300;
const HEIGHT = 100;

const STROKE: Record<TrendTone, string> = {
  spent: "stroke-brand stroke-2",
  over: "stroke-danger stroke-2",
  pace: "stroke-text-3 [stroke-dasharray:3_4] [stroke-width:1.5]",
  projection: "stroke-danger stroke-2 opacity-55 [stroke-dasharray:2_5]",
};

const DOT: Record<TrendTone, string> = {
  spent: "fill-brand",
  over: "fill-danger",
  pace: "fill-text-3",
  projection: "fill-danger",
};

const round = (value: number): number => Math.round(value * 10) / 10;

const xOf = (index: number, span: number): number =>
  span > 1 ? round((index / (span - 1)) * WIDTH) : WIDTH / 2;

const yOf = (value: number, top: number): number =>
  round(HEIGHT - (top > 0 ? (value / top) * HEIGHT : 0));

function pathOf(points: readonly (number | null)[], span: number, top: number): string {
  let drawing = false;
  let path = "";
  points.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${String(xOf(index, span))} ${String(yOf(value, top))} `;
    drawing = true;
  });
  return path.trim();
}

function lastPoint(
  points: readonly (number | null)[],
  span: number,
  top: number,
): { x: number; y: number } | null {
  const index = points.reduce<number>((last, value, at) => (value === null ? last : at), -1);
  const value = index >= 0 ? points[index] : null;
  if (value === null || value === undefined) return null;
  return { x: xOf(index, span), y: yOf(value, top) };
}

export function Trend({ lines, label, limit, height = 128, points, className }: TrendProps) {
  const [pointed, setPointed] = useState<number | null>(null);
  const sliding = useRef(false);
  const before = useRef<number | null>(null);
  const span = Math.max(1, ...lines.map((line) => line.points.length));
  const values = lines.flatMap((line) => line.points).filter((value) => value !== null);
  const top = Math.max(0, ...values, limit ?? 0);
  const rule = limit === undefined ? null : yOf(limit, top);
  const active = points && pointed !== null && points[pointed] ? pointed : null;

  const chart = (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      preserveAspectRatio="none"
      style={points ? undefined : { height }}
      className={cn("w-full overflow-visible", points ? "h-full" : null, className)}
    >
      {rule !== null && (
        <path
          d={`M0 ${String(rule)} L${String(WIDTH)} ${String(rule)}`}
          className="fill-none stroke-danger [stroke-width:1.5] [stroke-dasharray:5_4]"
        />
      )}
      {lines.map((line, index) => (
        <path
          key={index}
          d={pathOf(line.points, span, top)}
          className={cn(
            "fill-none [stroke-linecap:round] [stroke-linejoin:round]",
            STROKE[line.tone],
          )}
        />
      ))}
      {active !== null && (
        <path
          d={`M${String(xOf(active, span))} 0 L${String(xOf(active, span))} ${String(HEIGHT)}`}
          className="fill-none stroke-border-strong [stroke-width:1]"
        />
      )}
      {active !== null &&
        lines.map((line, index) => {
          const value = line.points[active];
          if (value === null || value === undefined) return null;
          return (
            <circle
              key={`pointed-${String(index)}`}
              cx={xOf(active, span)}
              cy={yOf(value, top)}
              r={3.5}
              className={cn("stroke-none", DOT[line.tone])}
            />
          );
        })}
      {lines.map((line, index) => {
        const point = line.dot === true ? lastPoint(line.points, span, top) : null;
        if (!point) return null;
        return (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3.5}
            className={cn("stroke-none", DOT[line.tone])}
          />
        );
      })}
    </svg>
  );

  if (!points) return chart;

  const whole = points.findLast((slot) => slot !== null) ?? null;
  const reading = active !== null ? points[active] : whole;

  function readAt(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    const share = (event.clientX - box.left) / box.width;
    const nearest = Math.min(Math.max(Math.round(share * (span - 1)), 0), span - 1);
    setPointed(points?.[nearest] ? nearest : null);
  }

  return (
    <span className="flex w-full flex-col gap-2">
      <span
        className="relative block w-full"
        style={{ height, marginTop: BUBBLE_ROOM }}
        onMouseLeave={() => {
          setPointed(null);
        }}
      >
        {chart}
        {active !== null && (
          // Pinned to the card, not to the band: a day of a month is narrower than its reading.
          <span aria-hidden="true" className={cn(BUBBLE, "inset-x-0 truncate text-center")}>
            {points[active]?.label}
          </span>
        )}
        <span
          aria-hidden="true"
          // Only the horizontal axis is the chart's: the page keeps its scroll and its pinch zoom.
          className="absolute inset-0 block touch-pan-y touch-pinch-zoom"
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") return;
            sliding.current = true;
            before.current = pointed;
            readAt(event);
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== "touch" || sliding.current) readAt(event);
          }}
          onPointerUp={() => {
            sliding.current = false;
          }}
          onPointerCancel={() => {
            sliding.current = false;
            setPointed(before.current);
          }}
        />
      </span>
      <Readout label={reading?.detail ?? reading?.label ?? ""} value={reading?.amount} />
    </span>
  );
}
