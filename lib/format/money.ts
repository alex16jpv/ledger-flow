export interface MoneyFormat {
  currency: string;
  locale: string;
}

export interface MoneyParts {
  symbol: string;
  integer: string;
  decimal: string;
  fraction: string;
  formatted: string;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string, options: Intl.NumberFormatOptions = {}) {
  const key = `${locale}|${currency}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      ...options,
    });
    formatters.set(key, cached);
  }
  return cached;
}

export function fractionDigits(currency: string): number {
  return formatter("en-US", currency).resolvedOptions().maximumFractionDigits ?? 2;
}

export function formatMoney(amount: number, { currency, locale }: MoneyFormat): string {
  return formatter(locale, currency).format(amount);
}

export function moneyParts(amount: number, { currency, locale }: MoneyFormat): MoneyParts {
  const parts = formatter(locale, currency).formatToParts(Math.abs(amount));
  const pick = (type: Intl.NumberFormatPartTypes) =>
    parts
      .filter((part) => part.type === type)
      .map((part) => part.value)
      .join("");
  const integer = parts
    .filter((part) => part.type === "integer" || part.type === "group")
    .map((part) => part.value)
    .join("");
  return {
    symbol: pick("currency"),
    integer,
    decimal: pick("decimal"),
    fraction: pick("fraction"),
    formatted: formatter(locale, currency).format(amount),
  };
}

export function decimalSeparators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseDecimal(input: string, locale: string): number | null {
  const { group, decimal } = decimalSeparators(locale);
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const normalized = trimmed
    .replace(new RegExp(`[${escape(group)}\\s\\u00a0\\u202f]`, "g"), "")
    .replace(new RegExp(escape(decimal), "g"), ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function roundToCurrency(amount: number, currency: string): number {
  const factor = 10 ** fractionDigits(currency);
  return Math.round(amount * factor) / factor;
}
