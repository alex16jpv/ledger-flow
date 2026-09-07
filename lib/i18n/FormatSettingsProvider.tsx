"use client";

import { useLocale } from "next-intl";
import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";

import { formatLocaleFor } from "./format-locale";
import { type AppLocale, isAppLocale } from "./routing";

export interface FormatSettings {
  locale: AppLocale;
  formatLocale: string;
  currency: string;
  timeZone: string;
}

export const DEFAULT_CURRENCY = "COP";
export const DEFAULT_TIME_ZONE = "America/Bogota";

const FormatSettingsContext = createContext<FormatSettings | null>(null);

const noop = () => () => undefined;
const deviceLanguage = () => navigator.language;
const noDeviceLanguage = () => null;

interface Props {
  currency?: string;
  timeZone?: string;
  children: ReactNode;
}

export function FormatSettingsProvider({
  currency = DEFAULT_CURRENCY,
  timeZone = DEFAULT_TIME_ZONE,
  children,
}: Props) {
  const rawLocale = useLocale();
  const locale: AppLocale = isAppLocale(rawLocale) ? rawLocale : "en";
  const language = useSyncExternalStore(noop, deviceLanguage, noDeviceLanguage);

  const value = useMemo<FormatSettings>(
    () => ({ locale, formatLocale: formatLocaleFor(locale, language), currency, timeZone }),
    [locale, language, currency, timeZone],
  );

  return <FormatSettingsContext.Provider value={value}>{children}</FormatSettingsContext.Provider>;
}

export function useFormatSettings(): FormatSettings {
  const context = useContext(FormatSettingsContext);
  if (!context) throw new Error("useFormatSettings requires a FormatSettingsProvider");
  return context;
}
