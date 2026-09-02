import { type AppLocale } from "./routing";

// The UI language is en|es; money and dates need a region: es → es-CO, en → en-US (DESIGN.md §0.6).
const DEFAULT_REGIONAL: Record<AppLocale, string> = { en: "en-US", es: "es-CO" };

export function formatLocaleFor(locale: AppLocale, deviceLanguage?: string | null): string {
  if (!deviceLanguage) return DEFAULT_REGIONAL[locale];
  try {
    const device = new Intl.Locale(deviceLanguage);
    if (device.language === locale && device.region) return `${locale}-${device.region}`;
  } catch {
    return DEFAULT_REGIONAL[locale];
  }
  return DEFAULT_REGIONAL[locale];
}
