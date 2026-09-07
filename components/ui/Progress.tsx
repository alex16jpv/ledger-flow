import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { cn } from "./cn";
import { Tooltip } from "./Tooltip";

export interface ProgressProps {
  value: number;
  max?: number;
  marker?: number;
  // What the mark means, in words. With it the mark becomes a focusable control with a tooltip
  // (7.7, F-08); without it, a line nobody can ask about.
  markerLabel?: string;
  thin?: boolean;
  color?: ColorToken | null;
  label: string;
  className?: string;
}

export function progressTone(ratio: number): "ok" | "warn" | "over" {
  if (ratio > 1) return "over";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

export function Progress({
  value,
  max = 1,
  marker,
  markerLabel,
  thin = false,
  color,
  label,
  className,
}: ProgressProps) {
  const ratio = max > 0 ? value / max : 0;
  const tone = progressTone(ratio);
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  const at = `${Math.min(100, Math.max(0, (marker ?? 0) * 100))}%`;
  return (
    // The bar clips its fill; the mark and its tooltip live outside that, or the bubble would be
    // cut off by the very element it explains.
    <div className={cn("relative", className)} style={featureColorStyle(color)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        className={cn("overflow-hidden rounded-[3px] bg-surface-3", thin ? "h-1" : "h-1.5")}
      >
        <span
          className={cn(
            "block h-full rounded-[3px] transition-[width] duration-(--dur-3) ease-(--ease)",
            tone === "over" ? "bg-danger-solid" : tone === "warn" ? "bg-warning-solid" : "bg-(--f)",
          )}
          style={{ width }}
        />
      </div>
      {marker !== undefined &&
        (markerLabel === undefined ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-text-3 opacity-60"
            style={{ left: at }}
          />
        ) : (
          <Tooltip label={markerLabel} className="absolute -top-1 -bottom-1" style={{ left: at }}>
            <button
              type="button"
              aria-label={markerLabel}
              className="h-full w-0.5 rounded-full bg-text-3 opacity-60 transition-[width,opacity] duration-(--dur-1) ease-(--ease) hover:w-[3px] hover:opacity-100 focus-visible:w-[3px] focus-visible:opacity-100 focus-visible:outline-none"
            />
          </Tooltip>
        ))}
    </div>
  );
}
