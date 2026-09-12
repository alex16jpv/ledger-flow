import type { CSSProperties, ReactNode } from "react";

import { cn } from "./cn";

export type TooltipAlign = "center" | "start" | "end";

export interface TooltipProps {
  label: ReactNode;
  align?: TooltipAlign;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const BUBBLE: Record<TooltipAlign, string> = {
  center: "left-1/2 -translate-x-1/2 after:left-1/2 after:-translate-x-1/2",
  start: "left-0 after:left-2.5",
  end: "right-0 after:right-2.5",
};

// Visual hint only: the wrapped control already carries its accessible name, so the bubble is hidden from readers.
export function Tooltip({ label, align = "center", className, style, children }: TooltipProps) {
  return (
    <span className={cn("group/tip relative inline-flex", className)} style={style}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-full z-(--z-toast) mb-1.5 rounded-sm bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-on-ink opacity-0 shadow-2 transition-opacity duration-(--dur-1) ease-(--ease)",
          "after:absolute after:top-full after:border-4 after:border-transparent after:border-t-ink after:content-['']",
          BUBBLE[align],
          "group-focus-within/tip:opacity-100 group-hover/tip:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}
