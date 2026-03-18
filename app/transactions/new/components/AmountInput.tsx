"use client";
import { useState, useEffect } from "react";
import { Control, useController } from "react-hook-form";
import FieldError from "@/components/forms/FieldError";
import { TransactionFormFields } from "@/lib/schemas/transaction.schema";

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

export default function AmountInput({
  control,
  error,
}: {
  control: Control<TransactionFormFields>;
  error?: string;
}) {
  const { field } = useController({
    name: "amount",
    control,
  });

  const [displayValue, setDisplayValue] = useState(() =>
    formatDisplay(field.value),
  );
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    field.onChange(parseAmount(raw));
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number when editing
    if (field.value !== undefined && !isNaN(field.value)) {
      setDisplayValue(field.value.toString());
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    field.onBlur();
    // Format on blur
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
        Amount
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
