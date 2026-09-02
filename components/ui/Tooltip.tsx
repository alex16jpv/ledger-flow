import type { ReactNode } from "react";

import { cn } from "./cn";

export interface TooltipProps {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}

// Visual hint only: the wrapped control already carries its accessible name, so the bubble is hidden from readers.
export function Tooltip({ label, className, children }: TooltipProps) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-(--z-toast) mb-1.5 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-on-ink opacity-0 shadow-2 transition-opacity duration-(--dur-1) ease-(--ease)",
          "group-focus-within/tip:opacity-100 group-hover/tip:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}
