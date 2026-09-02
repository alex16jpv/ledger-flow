import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "warning" | "danger" | "success" | "info" | "brand" | "outline";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-text-2",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand-text",
  outline: "border border-border-strong bg-transparent text-text-2",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-[7px] text-xs font-medium whitespace-nowrap [&>svg]:size-[11px] [&>svg]:stroke-[2.5]",
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
