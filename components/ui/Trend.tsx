import { cn } from "./cn";

export type TrendTone = "spent" | "over" | "pace" | "projection";

export interface TrendLine {
  points: readonly (number | null)[];
  tone: TrendTone;
  dot?: boolean;
}

export interface TrendProps {
  lines: readonly TrendLine[];
  label: string;
  limit?: number;
  height?: number;
  className?: string;
}

const WIDTH = 300;
const HEIGHT = 100;

const STROKE: Record<TrendTone, string> = {
  spent: "stroke-brand stroke-2",
  over: "stroke-danger stroke-2",
  pace: "stroke-text-3 [stroke-dasharray:3_4] [stroke-width:1.5]",
  projection: "stroke-danger stroke-2 opacity-55 [stroke-dasharray:2_5]",
};

const DOT: Record<TrendTone, string> = {
  spent: "fill-brand",
  over: "fill-danger",
  pace: "fill-text-3",
  projection: "fill-danger",
};

const round = (value: number): number => Math.round(value * 10) / 10;

function pathOf(points: readonly (number | null)[], span: number, top: number): string {
  let drawing = false;
  let path = "";
  points.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = span > 1 ? round((index / (span - 1)) * WIDTH) : WIDTH / 2;
    const y = round(HEIGHT - (top > 0 ? (value / top) * HEIGHT : 0));
    path += `${drawing ? "L" : "M"}${String(x)} ${String(y)} `;
    drawing = true;
  });
  return path.trim();
}

function lastPoint(
  points: readonly (number | null)[],
  span: number,
  top: number,
): { x: number; y: number } | null {
  const index = points.reduce<number>((last, value, at) => (value === null ? last : at), -1);
  const value = index >= 0 ? points[index] : null;
  if (value === null || value === undefined) return null;
  return {
    x: span > 1 ? round((index / (span - 1)) * WIDTH) : WIDTH / 2,
    y: round(HEIGHT - (top > 0 ? (value / top) * HEIGHT : 0)),
  };
}

// Component 31: a line is not slots, so it reads itself as one image and the card says it in words.
export function Trend({ lines, label, limit, height = 128, className }: TrendProps) {
  const span = Math.max(1, ...lines.map((line) => line.points.length));
  const values = lines.flatMap((line) => line.points).filter((value) => value !== null);
  const top = Math.max(0, ...values, limit ?? 0);
  const rule = limit === undefined ? null : round(HEIGHT - (top > 0 ? (limit / top) * HEIGHT : 0));
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      preserveAspectRatio="none"
      style={{ height }}
      className={cn("w-full", className)}
    >
      {rule !== null && (
        <path
          d={`M0 ${String(rule)} L${String(WIDTH)} ${String(rule)}`}
          className="fill-none stroke-danger [stroke-width:1.5] [stroke-dasharray:5_4]"
        />
      )}
      {lines.map((line, index) => (
        <path
          key={index}
          d={pathOf(line.points, span, top)}
          className={cn(
            "fill-none [stroke-linecap:round] [stroke-linejoin:round]",
            STROKE[line.tone],
          )}
        />
      ))}
      {lines.map((line, index) => {
        const point = line.dot === true ? lastPoint(line.points, span, top) : null;
        if (!point) return null;
        return (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3.5}
            className={cn("stroke-none", DOT[line.tone])}
          />
        );
      })}
    </svg>
  );
}
