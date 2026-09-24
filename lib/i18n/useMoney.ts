"use client";

import { useMemo } from "react";

import { currencyFractionDigits } from "@/lib/format/currency";
import { formatMoney, moneyParts, parseDecimal, roundToCurrency } from "@/lib/format/money";

import { useFormatSettings } from "./FormatSettingsProvider";

export function useMoney() {
  const { currency, formatLocale } = useFormatSettings();
  return useMemo(() => {
    const fractionDigits = currencyFractionDigits(currency);
    const options = { currency, locale: formatLocale };
    return {
      currency,
      locale: formatLocale,
      fractionDigits,
      format: (amount: number) => formatMoney(amount, options),
      parts: (amount: number) => moneyParts(amount, options),
      parse: (input: string, digits = fractionDigits) => parseDecimal(input, formatLocale, digits),
      round: (amount: number) => roundToCurrency(amount, currency),
    };
  }, [currency, formatLocale]);
}
