"use client";

import {
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import { cn } from "./cn";

const EPSILON = 0.01;

export interface ChipFit {
  widths: readonly number[];
  pinned: readonly number[];
  trailing: number;
  row: number;
  gap: number;
  lines: number;
}

function linesOf(widths: readonly number[], row: number, gap: number): number {
  let lines = 1;
  let used = -1;
  for (const raw of widths) {
    const width = Math.min(raw, row);
    if (used >= 0 && used + gap + width > row + EPSILON) {
      lines += 1;
      used = width;
    } else {
      used = used < 0 ? width : used + gap + width;
    }
  }
  return lines;
}

export function fitChips({ widths, pinned, trailing, row, gap, lines }: ChipFit): number[] {
  const order = widths
    .map((width, index) => ({ width, index }))
    .sort((a, b) => Number(pinned.includes(b.index)) - Number(pinned.includes(a.index)));
  let kept: { width: number; index: number }[] = [];
  for (const chip of order) {
    const isPinned = pinned.includes(chip.index);
    if (!isPinned && chip.width > row + EPSILON) continue;
    const next = [...kept, chip].sort((a, b) => a.index - b.index);
    const drawn = [...next.map(({ width }) => width), trailing];
    if (isPinned || linesOf(drawn, row, gap) <= lines) kept = next;
  }
  return kept.map(({ index }) => index);
}

export interface FittedChipsProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: readonly T[];
  keyOf: (item: T) => string;
  pinned?: string | null;
  lines: number;
  renderItem: (item: T) => ReactNode;
  trailing: ReactNode;
}

export function FittedChips<T>({
  items,
  keyOf,
  pinned = null,
  lines,
  renderItem,
  trailing,
  className,
  ...rest
}: FittedChipsProps<T>) {
  const row = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const [kept, setKept] = useState<readonly string[] | null>(null);
  const signature = items.map(keyOf).join("\n");

  useLayoutEffect(() => {
    const rowElement = row.current;
    const rulerElement = ruler.current;
    if (!rowElement || !rulerElement) return;
    const keys = signature === "" ? [] : signature.split("\n");
    const measure = () => {
      const box = rowElement.getBoundingClientRect().width;
      if (box === 0) return;
      const scale = rowElement.offsetWidth > 0 ? box / rowElement.offsetWidth : 1;
      const widths = [...rulerElement.children].map((child) => child.getBoundingClientRect().width);
      const trailingWidth = widths.pop() ?? 0;
      const focused =
        document.activeElement?.closest<HTMLElement>("[data-chip-key]")?.dataset.chipKey ?? null;
      const fit = fitChips({
        widths,
        pinned: [pinned, focused].flatMap((key) => {
          const index = key === null ? -1 : keys.indexOf(key);
          return index < 0 ? [] : [index];
        }),
        trailing: trailingWidth,
        row: box,
        gap: (Number.parseFloat(getComputedStyle(rowElement).columnGap) || 0) * scale,
        lines,
      });
      const fitKeys = keys.filter((_, index) => fit.includes(index));
      setKept((previous) =>
        previous?.length === fitKeys.length && previous.every((key, at) => key === fitKeys[at])
          ? previous
          : fitKeys,
      );
    };
    measure();
    // A resize is observed after layout; rendering it now keeps the stale chips off the next paint.
    const observer = new ResizeObserver(() => {
      flushSync(measure);
    });
    observer.observe(rowElement);
    observer.observe(rulerElement);
    return () => {
      observer.disconnect();
    };
  }, [signature, pinned, lines]);

  const shown = kept === null ? items : items.filter((item) => kept.includes(keyOf(item)));

  return (
    <div className="relative min-w-0">
      <div ref={row} className={cn("flex min-w-0 flex-wrap gap-2", className)} {...rest}>
        {shown.map((item) => (
          <span key={keyOf(item)} data-chip-key={keyOf(item)} className="contents">
            {renderItem(item)}
          </span>
        ))}
        {trailing}
      </div>
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        <div ref={ruler} className="flex w-max gap-2">
          {items.map((item) => (
            <Fragment key={keyOf(item)}>{renderItem(item)}</Fragment>
          ))}
          {trailing}
        </div>
      </div>
    </div>
  );
}
