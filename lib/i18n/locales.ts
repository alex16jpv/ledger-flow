export const LOCALES = ["en", "es"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_COOKIE = "lf_locale";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// next-intl prefixes every locale but the default one ("as-needed" in the routing below).
export function localePrefix(locale: string): string {
  return isAppLocale(locale) && locale !== DEFAULT_LOCALE ? `/${locale}` : "";
}

export function localeOf(pathname: string): AppLocale {
  const segment = pathname.split("/")[1];
  return isAppLocale(segment) ? segment : DEFAULT_LOCALE;
}
