"use client";
import { useState, useEffect } from "react";
import { Control, FieldValues, useController } from "react-hook-form";
import FieldError from "@/components/forms/FieldError";

function formatDisplay(value: number | undefined): string {
  if (value === undefined || isNaN(value)) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, "");
  if (cleaned === "") return undefined;
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

export default function AmountInput<T extends FieldValues>({
  control,
  error,
  label = "Amount",
}: {
  control: Control<T>;
  error?: string;
  label?: string;
}) {
  const { field } = useController({
    name: "amount" as never,
    control,
  });

  const value = field.value as number | undefined;

  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value));
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    field.onChange(parseAmount(raw));
  };

  const handleFocus = () => {
    setIsFocused(true);
    const v = field.value as number | undefined;
    if (v !== undefined && !isNaN(v)) {
      setDisplayValue(v.toString());
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    field.onBlur();
    setDisplayValue(formatDisplay(field.value as number | undefined));
  };

  // Sync displayValue when form resets (field.value changes externally)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatDisplay(field.value as number | undefined));
    }
  }, [field.value, isFocused]);

  return (
    <div>
      <label htmlFor="amount" className="field-label">
        {label}
      </label>
      <div className="amount-wrapper">
        <span className="amount-currency">$</span>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          className="input-amount"
          placeholder="0.00"
          autoComplete="off"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          ref={field.ref}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}
