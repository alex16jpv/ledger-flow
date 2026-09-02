import { cn } from "./cn";

export interface Bar {
  value: number;
  label: string;
  today?: boolean;
}

export interface BarsProps {
  bars: readonly Bar[];
  label: string;
  height?: number;
  onSelect?: (index: number) => void;
  className?: string;
}

export function Bars({ bars, label, height = 56, onSelect, className }: BarsProps) {
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("flex items-end gap-1", className)}
      style={{ height }}
    >
      {bars.map((bar, index) => {
        const ratio = max > 0 ? bar.value / max : 0;
        const classes = cn(
          "block min-h-[3px] flex-1 rounded-t-[3px] rounded-b-px",
          bar.value === 0 ? "bg-surface-3" : "bg-brand",
          bar.value > 0 && !bar.today && ratio < 1 && "opacity-35",
        );
        const style = { height: `${Math.max(ratio * 100, 0)}%` };
        return onSelect ? (
          <button
            key={index}
            type="button"
            aria-label={bar.label}
            onClick={() => {
              onSelect(index);
            }}
            className={cn(classes, "cursor-pointer")}
            style={style}
          />
        ) : (
          <i key={index} title={bar.label} className={classes} style={style} />
        );
      })}
    </div>
  );
}
