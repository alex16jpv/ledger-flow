"use client";

import { type ChangeEvent, useId, useState } from "react";

import { useMoney } from "@/lib/i18n/useMoney";

import { cn } from "./cn";

export interface AmountInputProps {
  defaultValue?: number | null;
  onChange: (value: number | null) => void;
  label: string;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

function editableText(
  value: number | null | undefined,
  locale: string,
  fractionDigits: number,
): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function AmountInput({
  defaultValue = null,
  onChange,
  label,
  autoFocus,
  invalid,
  describedBy,
  className,
}: AmountInputProps) {
  const money = useMoney();
  const id = useId();
  const [text, setText] = useState(() =>
    editableText(defaultValue, money.locale, money.fractionDigits),
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/[^\d.,\s\u00a0-]/g, "");
    setText(next);
    if (next.trim() === "") {
      onChange(null);
      return;
    }
    onChange(money.parse(next) ?? Number.NaN);
  }

  return (
    <label
      htmlFor={id}
      className={cn("flex items-baseline justify-center gap-1 px-4 py-6 tabular-nums", className)}
    >
      <span className="text-xl font-medium text-text-3">{money.parts(0).symbol}</span>
      <input
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
