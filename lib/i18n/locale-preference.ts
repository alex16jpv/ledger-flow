import { type AppLocale, DEFAULT_LOCALE, isAppLocale } from "./routing";

export type LocaleMode = "device" | "fixed";

export const LOCALE_MODE_KEY = "lf.localeMode";

export function deviceLocale(language: string | undefined | null): AppLocale {
  const base = language?.split("-")[0]?.toLowerCase();
  return isAppLocale(base) ? base : DEFAULT_LOCALE;
}

export function readLocaleMode(storage: Pick<Storage, "getItem"> | null): LocaleMode {
  try {
    return storage?.getItem(LOCALE_MODE_KEY) === "device" ? "device" : "fixed";
  } catch {
    return "fixed";
  }
}

export function writeLocaleMode(storage: Pick<Storage, "setItem"> | null, mode: LocaleMode): void {
  try {
    storage?.setItem(LOCALE_MODE_KEY, mode);
  } catch {
    return;
  }
}
