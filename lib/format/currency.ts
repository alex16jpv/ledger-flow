import type { ZeroDecimalCurrency } from "@/types/api";

export const DEFAULT_CURRENCY_CODE = "COP";

const REGION_CURRENCY: Record<string, string> = {
  CO: "COP",
  US: "USD",
  MX: "MXN",
  AR: "ARS",
  CL: "CLP",
  PE: "PEN",
  EC: "USD",
  VE: "VES",
  BO: "BOB",
  PY: "PYG",
  UY: "UYU",
  BR: "BRL",
  PA: "PAB",
  CR: "CRC",
  GT: "GTQ",
  HN: "HNL",
  NI: "NIO",
  SV: "USD",
  DO: "DOP",
  CU: "CUP",
  PR: "USD",
  CA: "CAD",
  ES: "EUR",
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  GB: "GBP",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  TR: "TRY",
  RU: "RUB",
  UA: "UAH",
  JP: "JPY",
  CN: "CNY",
  KR: "KRW",
  IN: "INR",
  ID: "IDR",
  TH: "THB",
  VN: "VND",
  PH: "PHP",
  MY: "MYR",
  SG: "SGD",
  HK: "HKD",
  TW: "TWD",
  AU: "AUD",
  NZ: "NZD",
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  EG: "EGP",
  MA: "MAD",
  AE: "AED",
  SA: "SAR",
  IL: "ILS",
};

// Frozen, not asked: a device's ICU says COP has 0 decimals here and 2 on an older phone.
export const ZERO_DECIMAL_CURRENCIES = [
  "AFN",
  "ALL",
  "BIF",
  "CLP",
  "COP",
  "DJF",
  "GNF",
  "HUF",
  "IDR",
  "IQD",
  "IRR",
  "ISK",
  "JPY",
  "KMF",
  "KPW",
  "KRW",
  "LAK",
  "LBP",
  "MGA",
  "MMK",
  "PKR",
  "PYG",
  "RWF",
  "SLL",
  "SOS",
  "SYP",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
  "YER",
] as const satisfies readonly ZeroDecimalCurrency[];

const ZERO_DECIMAL = new Set<string>(ZERO_DECIMAL_CURRENCIES);

const DEFAULT_FRACTION_DIGITS = 2;

export function currencyFractionDigits(code: string): number {
  return ZERO_DECIMAL.has(code.toUpperCase()) ? 0 : DEFAULT_FRACTION_DIGITS;
}

export function currencyForRegion(region: string | undefined | null): string {
  if (!region) return DEFAULT_CURRENCY_CODE;
  return REGION_CURRENCY[region.toUpperCase()] ?? DEFAULT_CURRENCY_CODE;
}

export function regionOf(languageTag: string | undefined | null): string | undefined {
  if (!languageTag) return undefined;
  try {
    return new Intl.Locale(languageTag).maximize().region;
  } catch {
    return undefined;
  }
}

export function listCurrencies(): string[] {
  return Intl.supportedValuesOf("currency");
}

export function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames(locale, { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function isKnownCurrency(code: string): boolean {
  return listCurrencies().includes(code);
}
