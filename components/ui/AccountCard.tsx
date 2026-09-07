import { Star } from "lucide-react";
import type { ReactNode } from "react";

import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { Badge } from "./Badge";
import { cn } from "./cn";
import { Dot } from "./Tile";

export interface AccountCardProps {
  name: string;
  typeLabel: ReactNode;
  balance: ReactNode;
  color?: ColorToken | null;
  mainLabel?: ReactNode;
  archivedLabel?: ReactNode;
  className?: string;
}

export function AccountCard({
  name,
  typeLabel,
  balance,
  color,
  mainLabel,
  archivedLabel,
  className,
}: AccountCardProps) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-1",
        "before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-r-[3px] before:bg-(--f)",
        archivedLabel ? "opacity-60" : null,
        className,
      )}
      style={featureColorStyle(color)}
    >
      <div className="flex items-center gap-2">
        <Dot color={color} />
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        {mainLabel && (
          <Badge tone="brand">
            <Star aria-hidden="true" />
            {mainLabel}
          </Badge>
        )}
        {archivedLabel && <Badge>{archivedLabel}</Badge>}
      </div>
      <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{balance}</span>
      <span className="text-xs text-text-3">{typeLabel}</span>
    </div>
  );
}

export function AccountCardGrid({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  // The horizontal carousel scrolls on small screens; a focusable region keeps it reachable by keyboard.
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-0.5 *:shrink-0 *:basis-[min(72%,260px)] *:snap-start",
        "sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:overflow-visible sm:px-0 sm:*:basis-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
