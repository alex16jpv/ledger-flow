import { cn } from "./cn";

export function StepDots({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 rounded-[3px]",
            index + 1 === current ? "w-[22px] bg-brand" : "w-1.5 bg-border-strong",
          )}
        />
      ))}
    </div>
  );
}
