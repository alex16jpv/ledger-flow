import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { Button } from "./Button";
import { cn } from "./cn";

export interface PeriodNavProps {
  label: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  nextDisabled?: boolean;
  className?: string;
}

export function PeriodNav({
  label,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  nextDisabled = false,
  className,
}: PeriodNavProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <Button variant="ghost" iconOnly round onClick={onPrevious} aria-label={previousLabel}>
        <ChevronLeft {...iconProps("md")} />
      </Button>
      <span aria-live="polite" className="text-md font-semibold text-text">
        {label}
      </span>
      <Button
        variant="ghost"
        iconOnly
        round
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
      >
        <ChevronRight {...iconProps("md")} />
      </Button>
    </div>
  );
}
