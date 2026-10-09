"use client";

import { useLocale } from "next-intl";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

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

export function FrozenTimeZone({ open = true, children }: { open?: boolean; children: ReactNode }) {
  const settings = useFormatSettings();
  const live = settings.timeZone;
  const ready = open && settings.profileResolved;
  const [frozen, setFrozen] = useState({ open, held: ready, timeZone: live });
  if (open !== frozen.open) {
    setFrozen(open ? { open, held: ready, timeZone: live } : { ...frozen, open });
  } else if (!frozen.held && (ready || frozen.timeZone !== live)) {
    setFrozen({ open, held: ready, timeZone: live });
  }
  const value = useMemo(
    () => ({ ...settings, timeZone: frozen.timeZone }),
    [settings, frozen.timeZone],
  );
  return <FormatSettingsContext.Provider value={value}>{children}</FormatSettingsContext.Provider>;
}
