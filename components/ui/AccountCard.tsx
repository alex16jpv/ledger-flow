import { Star } from "lucide-react";
import type { ReactNode } from "react";

import { Link } from "@/lib/i18n/navigation";
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
  href?: string;
}

const CARD =
  "relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-1 before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-r-[3px] before:bg-(--f)";
const OPENS =
  "transition-[border-color] duration-(--dur-1) ease-(--ease) hover:border-border-strong focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none";
// Dims the contents, never the box: opacity on the focusable element dims its focus ring too.
const ARCHIVED = "[&>*]:opacity-60 before:opacity-60";

export function AccountCard({
  name,
  typeLabel,
  balance,
  color,
  mainLabel,
  archivedLabel,
  href,
}: AccountCardProps) {
  const paint = cn(CARD, href !== undefined && OPENS, archivedLabel ? ARCHIVED : null);
  const body = (
    <>
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
    </>
  );
  return href === undefined ? (
    <div className={paint} style={featureColorStyle(color)}>
      {body}
    </div>
  ) : (
    <Link href={href} className={paint} style={featureColorStyle(color)}>
      {body}
    </Link>
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
        "-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 py-1 *:shrink-0 *:basis-[min(72%,260px)] *:snap-start",
        "sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:overflow-visible sm:px-0 sm:py-0 sm:*:basis-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
