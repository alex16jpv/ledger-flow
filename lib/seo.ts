import type { Metadata } from "next";

import { env } from "@/lib/env";
import { type AppLocale, LOCALES } from "@/lib/i18n/routing";

export const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/login", "/register"] as const;
export type PublicPath = (typeof PUBLIC_PATHS)[number];

export function publicUrl(path: string, locale: AppLocale): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const suffix = path === "/" ? "" : path;
  return new URL(`${prefix}${suffix}` || "/", env.NEXT_PUBLIC_APP_URL).toString();
}

// Canonical, hreflang (en, es, x-default) and Open Graph for one public page; the base URL comes only from env.
export function publicMetadata(
  path: PublicPath,
  locale: AppLocale,
  {
    title,
    description,
    absoluteTitle = false,
  }: { title: string; description: string; absoluteTitle?: boolean },
): Metadata {
  const url = publicUrl(path, locale);
  const languages = Object.fromEntries(LOCALES.map((code) => [code, publicUrl(path, code)]));
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: { ...languages, "x-default": publicUrl(path, "en") } },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "Ledger Flow",
      locale: locale === "es" ? "es_CO" : "en_US",
      alternateLocale: locale === "es" ? ["en_US"] : ["es_CO"],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
