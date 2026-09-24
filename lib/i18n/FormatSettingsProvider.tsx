"use client";

import { useLocale } from "next-intl";
import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";

import { DEFAULT_CURRENCY_CODE } from "@/lib/format/currency";
import { DEFAULT_TIME_ZONE_ID } from "@/lib/format/timezone";

import { formatLocaleFor } from "./format-locale";
import { type AppLocale, isAppLocale } from "./routing";

export interface FormatSettings {
  locale: AppLocale;
  formatLocale: string;
  currency: string;
  timeZone: string;
  profileResolved: boolean;
}

const FormatSettingsContext = createContext<FormatSettings | null>(null);

const noop = () => () => undefined;
const deviceLanguage = () => navigator.language;
const noDeviceLanguage = () => null;

interface Props {
  currency?: string;
  timeZone?: string;
  profileResolved?: boolean;
  children: ReactNode;
}

export function FormatSettingsProvider({
  currency = DEFAULT_CURRENCY_CODE,
  timeZone = DEFAULT_TIME_ZONE_ID,
  profileResolved = true,
  children,
}: Props) {
  const rawLocale = useLocale();
  const locale: AppLocale = isAppLocale(rawLocale) ? rawLocale : "en";
  const language = useSyncExternalStore(noop, deviceLanguage, noDeviceLanguage);

  const value = useMemo<FormatSettings>(
    () => ({
      locale,
      formatLocale: formatLocaleFor(locale, language),
      currency,
      timeZone,
      profileResolved,
    }),
    [locale, language, currency, timeZone, profileResolved],
  );

  return <FormatSettingsContext.Provider value={value}>{children}</FormatSettingsContext.Provider>;
}

export function useFormatSettings(): FormatSettings {
  const context = useContext(FormatSettingsContext);
  if (!context) throw new Error("useFormatSettings requires a FormatSettingsProvider");
  return context;
}
