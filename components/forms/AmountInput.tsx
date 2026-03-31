"use client";
import { useState, useEffect } from "react";
import { Control, FieldValues, Path, useController } from "react-hook-form";
import FieldError from "@/components/forms/FieldError";
import { APP_LOCALE, APP_CURRENCY_SYMBOL } from "@/utils/constants";

function formatDisplay(value: number | undefined): string {
  if (value === undefined || isNaN(value)) return "";
  return new Intl.NumberFormat(APP_LOCALE, {
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
  name = "amount" as Path<T>,
}: {
  control: Control<T>;
  error?: string;
  label?: string;
  name?: Path<T>;
}) {
  const { field } = useController({
    name,
    control,
  });

  const value: number | undefined = field.value;

  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value));
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    field.onChange(parseAmount(raw));
  };

  const handleFocus = () => {
    setIsFocused(true);
    const currentValue: number | undefined = field.value;
    if (currentValue !== undefined && !isNaN(currentValue)) {
      setDisplayValue(currentValue.toString());
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    field.onBlur();
    setDisplayValue(formatDisplay(field.value));
  };

  // Sync displayValue when form resets (field.value changes externally)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatDisplay(field.value));
    }
  }, [field.value, isFocused]);

  return (
    <div>
      <label htmlFor="amount" className="field-label">
        {label}
      </label>
      <div className="amount-wrapper">
        <span className="amount-currency">{APP_CURRENCY_SYMBOL}</span>
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
