"use client";

import { useMemo } from "react";

import { currencyFractionDigits } from "@/lib/format/currency";
import { formatMoney, moneyParts, parseDecimal, roundToCurrency } from "@/lib/format/money";

import { useFormatSettings } from "./FormatSettingsProvider";

export function useMoney() {
  const { currency, formatLocale } = useFormatSettings();
  return useMemo(() => {
    const options = { currency, locale: formatLocale };
    return {
      currency,
      locale: formatLocale,
      fractionDigits: currencyFractionDigits(currency),
      format: (amount: number) => formatMoney(amount, options),
      parts: (amount: number) => moneyParts(amount, options),
      parse: (input: string) => parseDecimal(input, formatLocale),
      round: (amount: number) => roundToCurrency(amount, currency),
    };
  }, [currency, formatLocale]);
}
