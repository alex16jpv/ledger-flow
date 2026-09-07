import { decimalSeparators, MAX_AMOUNT } from "./money";

export interface EditableAmount {
  text: string;
  value: number | null;
}

const MAX_INTEGER_DIGITS = String(MAX_AMOUNT).length;

// Turns whatever the user typed into the locale's grouped text and the clean number the API gets.
export function formatEditableAmount(
  raw: string,
  locale: string,
  fractionDigits: number,
): EditableAmount {
  const { decimal } = decimalSeparators(locale);
  const decimalAt = fractionDigits > 0 ? raw.indexOf(decimal) : -1;
  const integerRaw = decimalAt === -1 ? raw : raw.slice(0, decimalAt);
  const fractionRaw = decimalAt === -1 ? "" : raw.slice(decimalAt + 1);
  const integer = integerRaw
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_INTEGER_DIGITS);
  const fraction = fractionRaw.replace(/\D/g, "").slice(0, fractionDigits);
  const hasDecimal = decimalAt !== -1;
  if (integer === "" && !hasDecimal) return { text: "", value: null };
  const integerDigits = integer === "" ? "0" : integer;
  const grouped = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(Number(integerDigits));
  return {
    text: hasDecimal ? `${grouped}${decimal}${fraction}` : grouped,
    value: Number(`${integerDigits}.${fraction || "0"}`),
  };
}

// Caret bookkeeping counts only the characters the user owns: digits and the decimal separator.
export function countUnits(raw: string, caret: number, decimal: string): number {
  let units = 0;
  let decimalSeen = false;
  for (const char of raw.slice(0, caret)) {
    if (/\d/.test(char)) units += 1;
    else if (char === decimal && !decimalSeen) {
      units += 1;
      decimalSeen = true;
    }
  }
  return units;
}

export function caretAfterUnits(text: string, units: number, decimal: string): number {
  if (units <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (/\d/.test(char) || char === decimal) {
      seen += 1;
      if (seen === units) return index + 1;
    }
  }
  return text.length;
}
