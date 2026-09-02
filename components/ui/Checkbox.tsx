"use client";

import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from "react";

import { cn } from "./cn";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children"
> {
  children: ReactNode;
  error?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { children, error, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn("flex cursor-pointer items-start gap-3 text-sm text-text-2", className)}
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className="peer sr-only"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-px grid size-5 shrink-0 place-items-center rounded-[6px] border-[1.5px] border-border-strong bg-surface text-on-brand",
            "peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] [&>svg]:invisible peer-checked:[&>svg]:visible",
          )}
        >
          <Check size={14} strokeWidth={2.5} />
        </span>
        <span>{children}</span>
      </label>
      {error && (
        <span id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
    </div>
  );
});
