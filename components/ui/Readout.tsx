import type { ReactNode } from "react";

import { cn } from "./cn";

export interface ReadoutProps {
  label: ReactNode;
  value?: ReactNode;
  className?: string;
}

export function Readout({ label, value, className }: ReadoutProps) {
  return (
    <p
      className={cn(
        "flex min-h-[18px] items-baseline justify-between gap-2 text-sm text-text-2",
        className,
      )}
    >
      <span>{label}</span>
      {value !== undefined && <span className="font-medium text-text tabular-nums">{value}</span>}
    </p>
  );
}
