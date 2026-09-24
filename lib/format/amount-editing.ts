import { DECIMAL_MARKS, decimalSeparators, MAX_AMOUNT, THOUSANDS_GROUP_DIGITS } from "./money";

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

export interface AmountEdit {
  previous: string;
  raw: string;
  caret: number;
  loose: boolean;
}

export type ReadAmountEdit = Omit<AmountEdit, "previous">;

function typedMark({ previous, raw, caret }: AmountEdit): string {
  const kept = raw.length - caret;
  const key = raw.charAt(caret - 1);
  if (caret < 1 || previous.length - kept < caret - 1 || !DECIMAL_MARKS.has(key)) return "";
  if (previous.charAt(caret - 1) === key) return "";
  const sameAround =
    raw.slice(0, caret - 1) === previous.slice(0, caret - 1) &&
    raw.slice(caret) === previous.slice(previous.length - kept);
  return sameAround ? key : "";
}

export function acceptDecimalKey(
  edit: AmountEdit,
  decimal: string,
  fractionDigits: number,
): ReadAmountEdit {
  const { caret } = edit;
  if (fractionDigits === 0) return { raw: edit.raw, caret, loose: false };
  const key = typedMark(edit);
  const rest = edit.raw.slice(0, caret - 1) + edit.raw.slice(caret);
  const foreign = key !== "" && key !== decimal && !rest.includes(decimal);
  const raw = foreign ? edit.raw.slice(0, caret - 1) + decimal + edit.raw.slice(caret) : edit.raw;
  const at = raw.indexOf(decimal);
  const loose = at !== -1 && (foreign || edit.loose);
  const fractionLength = raw.slice(at + 1).replace(/\D/g, "").length;
  if (!loose || fractionLength <= fractionDigits) return { raw, caret, loose };
  if (caret !== raw.length || fractionLength !== THOUSANDS_GROUP_DIGITS) {
    return { raw, caret, loose: false };
  }
  return { raw: raw.slice(0, at) + raw.slice(at + 1), caret: caret - 1, loose: false };
}

export function padLeadingDecimal(
  raw: string,
  caret: number,
  decimal: string,
  fractionDigits: number,
): { raw: string; caret: number } {
  const at = raw.indexOf(decimal);
  if (fractionDigits === 0 || at === -1 || /\d/.test(raw.slice(0, at))) return { raw, caret };
  return { raw: `0${raw}`, caret: caret + 1 };
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
