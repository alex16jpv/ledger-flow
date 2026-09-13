"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";

export interface RovingSlots {
  rover: number | null;
  hovered: number | null;
  focused: number | null;
  active: number | null;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  slotProps: (index: number) => {
    ref: (node: HTMLButtonElement | null) => void;
    tabIndex: number;
    onFocus: () => void;
    onBlur: () => void;
    onMouseEnter: () => void;
  };
}

// F-90: a chart is one tab stop. The arrows walk the slots that exist; the rest of the page is next.
export function useRovingSlots(
  available: readonly number[],
  step: (key: string) => number | null,
  entry: number | null,
): RovingSlots {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const slots = useRef(new Map<number, HTMLButtonElement>());

  const first = available[0] ?? null;
  const last = available[available.length - 1] ?? null;
  // A slot that stopped existing (midnight passed, a refetch reshaped the series) hands focus left.
  const nearest = (index: number) => available.findLast((slot) => slot <= index) ?? first;
  const rover =
    entered === null ? (entry ?? first) : available.includes(entered) ? entered : nearest(entered);
  const lostFocus = focused !== null && !available.includes(focused);

  useEffect(() => {
    if (!lostFocus || rover === null) return;
    slots.current.get(rover)?.focus();
  }, [lostFocus, rover]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const from = available.indexOf(rover ?? -1);
    if (from < 0) return;
    const delta = step(event.key);
    const target =
      delta !== null
        ? (available[Math.min(Math.max(from + delta, 0), available.length - 1)] ?? null)
        : event.key === "Home"
          ? first
          : event.key === "End"
            ? last
            : undefined;
    if (target === undefined || target === null) return;
    event.preventDefault();
    setEntered(target);
    slots.current.get(target)?.focus();
  }

  return {
    rover,
    hovered,
    focused,
    active: hovered ?? focused,
    onKeyDown,
    onMouseLeave: () => {
      setHovered(null);
    },
    slotProps: (index: number) => ({
      ref: (node: HTMLButtonElement | null) => {
        if (node) slots.current.set(index, node);
        else slots.current.delete(index);
      },
      tabIndex: index === rover ? 0 : -1,
      onFocus: () => {
        setEntered(index);
        setFocused(index);
      },
      onBlur: () => {
        setFocused((current) => (current === index ? null : current));
      },
      onMouseEnter: () => {
        setHovered(index);
      },
    }),
  };
}
