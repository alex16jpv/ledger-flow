import { currencyFractionDigits } from "./currency";

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

// Ceiling agreed with the backend: amounts are stored as integer cents and must stay a safe integer.
export const MAX_AMOUNT = 10_000_000_000_000;

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string) {
  const key = `${locale}|${currency}`;
  let cached = formatters.get(key);
  if (!cached) {
    const digits = currencyFractionDigits(currency);
    cached = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(key, cached);
  }
  return cached;
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

export const formatPlainNumber = (value: number, locale: string, maximumFractionDigits = 20) =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits }).format(value);

export function decimalSeparators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

export const DECIMAL_MARKS: ReadonlySet<string> = new Set([".", ","]);
export const THOUSANDS_GROUP_DIGITS = 3;
const MARK = "[.,]";
const MARKS = new RegExp(MARK, "g");
const GROUPED_INTEGER = new RegExp(
  `^[1-9]\\d{0,2}(?:${MARK}\\d{2,3})*${MARK}\\d{${THOUSANDS_GROUP_DIGITS}}$`,
);
const NUMBER_TEXT = new RegExp(`^(-?)((?:\\d|${MARK})+)$`);
const NOT_A_FIGURE = new RegExp(`(?!${MARK})[^\\d\\s-]`, "g");

export const figureIn = (text: string): string => text.replace(NOT_A_FIGURE, "");

function decimalMarkAt(body: string, decimal: string, fractionDigits: number): number | null {
  const marks = body.match(MARKS) ?? [];
  if (marks.length === 0) return -1;
  const at = Math.max(body.lastIndexOf("."), body.lastIndexOf(","));
  const mark = body.charAt(at);
  const after = body.length - at - 1;
  const repeats = marks.filter((one) => one === mark).length;
  if (marks.some((one) => one !== mark))
    return repeats === 1 && after <= fractionDigits ? at : null;
  if (repeats > 1) return -1;
  const decimalFits =
    after <= fractionDigits && (mark === decimal || after !== THOUSANDS_GROUP_DIGITS);
  return decimalFits ? at : -1;
}

export function parseDecimal(input: string, locale: string, fractionDigits: number): number | null {
  const { group, decimal } = decimalSeparators(locale);
  const spaced = input.replace(/\s/g, "");
  const compact = DECIMAL_MARKS.has(group) ? spaced : spaced.replaceAll(group, "");
  const match = NUMBER_TEXT.exec(compact);
  if (!match) return null;
  const [, sign = "", body = ""] = match;
  const at = decimalMarkAt(body, decimal, fractionDigits);
  if (at === null) return null;
  const integer = at === -1 ? body : body.slice(0, at);
  const fraction = at === -1 ? "" : body.slice(at + 1);
  if (!/^\d+$/.test(integer) && !GROUPED_INTEGER.test(integer)) return null;
  const value = Number(`${sign}${integer.replace(MARKS, "")}.${fraction || "0"}`);
  return Number.isFinite(value) ? value : null;
}

export function roundToCurrency(amount: number, currency: string): number {
  const factor = 10 ** currencyFractionDigits(currency);
  return Math.round(amount * factor) / factor;
}
