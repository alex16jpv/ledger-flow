import { ChevronRight } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";

export interface PickerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "value" | "placeholder"
> {
  label: ReactNode;
  value?: ReactNode;
  placeholder?: ReactNode;
  leading?: ReactNode;
}

export const Picker = forwardRef<HTMLButtonElement, PickerProps>(function Picker(
  { label, value, placeholder, leading, className, type = "button", ...rest },
  ref,
) {
  const empty = value === undefined || value === null || value === "";
  return (
    <button
      ref={ref}
      type={type}
      aria-haspopup="dialog"
      className={cn(
        "flex min-h-(--control-lg) w-full items-center gap-3 rounded-md border border-border-strong bg-surface py-1.5 pr-3 pl-1.5 text-left transition-[border-color,box-shadow] duration-(--dur-1) ease-(--ease) focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none disabled:bg-surface-2 disabled:text-text-disabled",
        className,
      )}
      {...rest}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-text-3">{label}</span>
        <span
          className={cn(
            "truncate text-base",
            empty ? "font-normal text-text-3" : "font-medium text-text",
          )}
        >
          {empty ? placeholder : value}
        </span>
      </span>
      <ChevronRight {...iconProps("md")} className="shrink-0 text-text-3" />
    </button>
  );
});
