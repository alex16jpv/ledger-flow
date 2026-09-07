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
