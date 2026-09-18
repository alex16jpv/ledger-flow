"use client";

import { type ChangeEvent, type Ref, useId, useLayoutEffect, useRef, useState } from "react";

import { caretAfterUnits, countUnits, formatEditableAmount } from "@/lib/format/amount-editing";
import { decimalSeparators } from "@/lib/format/money";
import { useMoney } from "@/lib/i18n/useMoney";

import { cn } from "./cn";
import { useFieldContext } from "./Field";

export type AmountTone = "default" | "income" | "transfer";
export type AmountSize = "lg" | "sm";

// The hero figure a screen is about, and the smaller one a second amount beside it takes (T-94).
const SIZE: Record<AmountSize, { symbol: string; input: string }> = {
  lg: { symbol: "text-xl", input: "text-[52px] tracking-[-0.035em]" },
  sm: { symbol: "text-base", input: "text-[28px] tracking-[-0.02em]" },
};

const TONE: Record<AmountTone, string> = {
  default: "text-text",
  income: "text-income",
  transfer: "text-transfer",
};

export interface AmountInputProps {
  defaultValue?: number | null;
  value?: number | null;
  tone?: AmountTone;
  size?: AmountSize;
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
  value,
  tone = "default",
  size = "lg",
  onChange,
  label,
  autoFocus,
  ref,
  invalid,
  describedBy,
  className,
}: AmountInputProps) {
  const money = useMoney();
  const field = useFieldContext();
  const invalidNow = invalid ?? field?.invalid;
  const describedByAll = describedBy ?? field?.describedBy;
  const ownId = useId();
  const id = field?.id ?? ownId;
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [text, setText] = useState(() =>
    initialText(defaultValue, money.locale, money.fractionDigits),
  );
  const [mine, setMine] = useState<number | null>(defaultValue);
  const { group, decimal } = decimalSeparators(money.locale);

  // Only a figure this input did not produce is written back in: an echo of its own would eat a half-typed decimal.
  if (value !== undefined && value !== mine) {
    setMine(value);
    setText(initialText(value, money.locale, money.fractionDigits));
  }

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
    setMine(next.value);
    onChange(next.value);
  }

  return (
    <label
      htmlFor={id}
      className={cn("flex items-baseline justify-center gap-1 px-4 py-6 tabular-nums", className)}
    >
      <span className={cn("font-medium text-text-3", SIZE[size].symbol)}>
        {money.parts(0).symbol}
      </span>
      <input
        ref={attachRef}
        id={id}
        type="text"
        inputMode={money.fractionDigits === 0 ? "numeric" : "decimal"}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={invalidNow ? true : undefined}
        aria-describedby={describedByAll}
        value={text}
        onChange={handleChange}
        placeholder="0"
        className={cn(
          "min-w-[2ch] bg-transparent leading-none font-semibold caret-brand outline-none placeholder:text-text-disabled",
          SIZE[size].input,
          invalidNow ? "text-danger" : TONE[tone],
        )}
        style={{ width: `${Math.max(2, text.length + 1)}ch` }}
      />
    </label>
  );
}
