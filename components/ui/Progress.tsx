import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { cn } from "./cn";

export interface ProgressProps {
  value: number;
  max?: number;
  marker?: number;
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
  thin = false,
  color,
  label,
  className,
}: ProgressProps) {
  const ratio = max > 0 ? value / max : 0;
  const tone = progressTone(ratio);
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn(
        "relative overflow-hidden rounded-[3px] bg-surface-3",
        thin ? "h-1" : "h-1.5",
        className,
      )}
      style={featureColorStyle(color)}
    >
      <span
        className={cn(
          "block h-full rounded-[3px] transition-[width] duration-(--dur-3) ease-(--ease)",
          tone === "over" ? "bg-danger-solid" : tone === "warn" ? "bg-warning-solid" : "bg-(--f)",
        )}
        style={{ width }}
      />
      {marker !== undefined && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-text-3 opacity-60"
          style={{ left: `${Math.min(100, Math.max(0, marker * 100))}%` }}
        />
      )}
    </div>
  );
}
