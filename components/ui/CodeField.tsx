"use client";

import {
  type ChangeEvent,
  forwardRef,
  type InputHTMLAttributes,
  type SyntheticEvent,
  useState,
} from "react";

import { cn } from "./cn";
import { useFieldContext } from "./Field";

const CODE_LENGTH = 6;

const digitsOf = (text: string): string => text.replace(/\D/g, "").slice(0, CODE_LENGTH);

// A paste, or the phone filling in the code it received, lands several characters in one input.
function arrivedAtOnce(event: ChangeEvent<HTMLInputElement>, before: string): boolean {
  const { inputType } = event.nativeEvent as InputEvent;
  if (inputType === "insertFromPaste" || inputType === "insertReplacementText") return true;
  return digitsOf(event.target.value).length - before.length > 1;
}

function keepCaretAtEnd(event: SyntheticEvent<HTMLInputElement>): boolean {
  const input = event.currentTarget;
  const end = input.value.length;
  const { selectionStart, selectionEnd } = input;
  if (selectionStart === 0 && selectionEnd === end && end > 0) return true;
  if (selectionStart !== end || selectionEnd !== end) input.setSelectionRange(end, end);
  return false;
}

export interface CodeFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "maxLength" | "children"
> {
  value: string;
  onChange: (digits: string) => void;
  onFilled?: () => void;
}

export const CodeField = forwardRef<HTMLInputElement, CodeFieldProps>(function CodeField(
  { value, onChange, onFilled, disabled, className, onFocus, onBlur, ...rest },
  ref,
) {
  const field = useFieldContext();
  const [focused, setFocused] = useState(false);
  const [allSelected, setAllSelected] = useState(false);
  const invalid = field?.invalid ?? false;
  const cursor = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <div className={cn("relative", className)}>
      <div aria-hidden="true" className="flex justify-center gap-2">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const ringed = focused && !invalid && !disabled && index === cursor;
          const selected = focused && allSelected && value.length > 0;
          return (
            <span
              key={index}
              className={cn(
                "grid h-14 max-w-[52px] min-w-0 flex-1 place-items-center rounded-md border font-mono text-2xl font-semibold tabular-nums transition-[border-color,box-shadow] duration-(--dur-1) ease-(--ease)",
                invalid
                  ? "border-danger-solid"
                  : ringed
                    ? "border-brand shadow-[0_0_0_3px_var(--focus-ring)]"
                    : "border-border-strong",
                disabled
                  ? "bg-surface-2 text-text-disabled"
                  : selected
                    ? "bg-brand-soft text-text"
                    : "bg-surface text-text",
              )}
            >
              {value[index] ?? ""}
            </span>
          );
        })}
      </div>
      <input
        ref={ref}
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={invalid ? true : undefined}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const digits = digitsOf(event.target.value);
          const atOnce = arrivedAtOnce(event, value);
          onChange(digits);
          if (atOnce && digits.length === CODE_LENGTH) onFilled?.();
        }}
        onSelect={(event) => {
          setAllSelected(keepCaretAtEnd(event));
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
        {...rest}
      />
    </div>
  );
});
