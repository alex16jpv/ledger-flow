import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES } from "./locales";

export {
  type AppLocale,
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE,
  localeOf,
  localePrefix,
  LOCALES,
} from "./locales";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeCookie: { name: LOCALE_COOKIE, sameSite: "lax" },
});
