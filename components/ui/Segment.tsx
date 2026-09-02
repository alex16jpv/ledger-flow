import type { ReactNode } from "react";

import { cn } from "./cn";

export type SegmentTone = "default" | "income" | "transfer";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  tone?: SegmentTone;
}

export interface SegmentProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  inline?: boolean;
  disabled?: boolean;
  className?: string;
}

const TONE: Record<SegmentTone, string> = {
  default: "aria-pressed:text-text",
  income: "aria-pressed:text-income",
  transfer: "aria-pressed:text-transfer",
};

export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
  inline = false,
  disabled = false,
  className,
}: SegmentProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-surface-2 p-[3px]",
        !inline && "w-full",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => {
            onChange(option.value);
          }}
          className={cn(
            "inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[8px] px-2 text-sm font-medium text-text-2 transition-[background,color,box-shadow] duration-(--dur-1) ease-(--ease)",
            "aria-pressed:bg-surface aria-pressed:shadow-1",
            TONE[option.tone ?? "default"],
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
