"use client";

import { type ChangeEvent, type Ref, useId, useLayoutEffect, useRef, useState } from "react";

import { caretAfterUnits, countUnits, formatEditableAmount } from "@/lib/format/amount-editing";
import { decimalSeparators } from "@/lib/format/money";
import { useMoney } from "@/lib/i18n/useMoney";

import { cn } from "./cn";

export interface AmountInputProps {
  defaultValue?: number | null;
  onChange: (value: number | null) => void;
  label: string;
  autoFocus?: boolean;
  ref?: Ref<HTMLInputElement>;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

function initialText(value: number | null | undefined, locale: string, fractionDigits: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const plain = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: fractionDigits,
  }).format(value);
  return formatEditableAmount(plain, locale, fractionDigits).text;
}

// Formatting is visual only: the text shows the locale's grouping while the parent receives the clean number.
export function AmountInput({
  defaultValue = null,
  onChange,
  label,
  autoFocus,
  ref,
  invalid,
  describedBy,
  className,
}: AmountInputProps) {
  const money = useMoney();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [text, setText] = useState(() =>
    initialText(defaultValue, money.locale, money.fractionDigits),
  );
  const { group, decimal } = decimalSeparators(money.locale);

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null || !inputRef.current) return;
    pendingCaret.current = null;
    inputRef.current.setSelectionRange(caret, caret);
  }, [text]);

  function attachRef(element: HTMLInputElement | null) {
    inputRef.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    let raw = event.target.value;
    let caret = event.target.selectionStart ?? raw.length;
    const inputType = (event.nativeEvent as Partial<InputEvent>).inputType;
    // Deleting a grouping separator alone would be re-inserted at once: take the digit next to it too.
    if (inputType === "deleteContentBackward" && text[caret] === group && caret > 0) {
      raw = raw.slice(0, caret - 1) + raw.slice(caret);
      caret -= 1;
    } else if (inputType === "deleteContentForward" && text[caret] === group) {
      raw = raw.slice(0, caret) + raw.slice(caret + 1);
    }
    const units = countUnits(raw, caret, decimal);
    const next = formatEditableAmount(raw, money.locale, money.fractionDigits);
    pendingCaret.current = caretAfterUnits(next.text, units, decimal);
    setText(next.text);
    onChange(next.value);
  }

  return (
    <label
      htmlFor={id}
      className={cn("flex items-baseline justify-center gap-1 px-4 py-6 tabular-nums", className)}
    >
      <span className="text-xl font-medium text-text-3">{money.parts(0).symbol}</span>
      <input
        ref={attachRef}
        id={id}
        type="text"
        inputMode={money.fractionDigits === 0 ? "numeric" : "decimal"}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        value={text}
        onChange={handleChange}
        placeholder="0"
        className={cn(
          "min-w-[2ch] bg-transparent text-[52px] leading-none font-semibold tracking-[-0.035em] text-text caret-brand outline-none placeholder:text-text-disabled",
          invalid && "text-danger",
        )}
        style={{ width: `${Math.max(2, text.length + 1)}ch` }}
      />
    </label>
  );
}
