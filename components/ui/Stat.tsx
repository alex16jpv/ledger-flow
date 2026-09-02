import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  delta?: { direction: "up" | "down" | "flat"; label: ReactNode };
  className?: string;
}

export function Stat({ label, value, delta, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm text-text-3">{label}</span>
      <span className="text-xl font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      {delta && (
        <span
          className={cn(
            "inline-flex items-center gap-[3px] text-xs",
            delta.direction === "up" && "text-income",
            delta.direction === "down" && "text-danger",
            delta.direction === "flat" && "text-text-3",
          )}
        >
          {delta.direction === "up" && <TrendingUp {...iconProps("sm")} className="size-3" />}
          {delta.direction === "down" && <TrendingDown {...iconProps("sm")} className="size-3" />}
          {delta.label}
        </span>
      )}
    </div>
  );
}
