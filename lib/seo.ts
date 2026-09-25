import type { Metadata } from "next";

import { env } from "@/lib/env";
import { type AppLocale, LOCALES } from "@/lib/i18n/routing";

export const BRAND = "Ledger Flow";
export const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/login", "/register"] as const;
export type PublicPath = (typeof PUBLIC_PATHS)[number];
export const NOINDEX_PATHS: ReadonlySet<PublicPath> = new Set(["/login"]);
export const INDEXED_PATHS = PUBLIC_PATHS.filter((path) => !NOINDEX_PATHS.has(path));
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export function publicUrl(path: string, locale: AppLocale): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const suffix = path === "/" ? "" : path;
  return new URL(`${prefix}${suffix}` || "/", env.NEXT_PUBLIC_APP_URL).toString();
}

export function publicLanguages(path: PublicPath): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((code) => [code, publicUrl(path, code)])),
    "x-default": publicUrl(path, "en"),
  };
}

// Always the prefixed route: the proxy leaves it alone, so `/en/…` answers the image and not a 307.
export function ogImageUrl(locale: AppLocale): string {
  return new URL(`/${locale}/opengraph-image`, env.NEXT_PUBLIC_APP_URL).toString();
}

export function publicMetadata(
  path: PublicPath,
  locale: AppLocale,
  {
    title,
    description,
    imageAlt,
    absoluteTitle = false,
  }: {
    title: string;
    description: string;
    imageAlt: string;
    absoluteTitle?: boolean;
  },
): Metadata {
  const url = publicUrl(path, locale);
  const socialTitle = absoluteTitle ? title : `${title} · ${BRAND}`;
  const image = { url: ogImageUrl(locale), ...OG_IMAGE_SIZE, alt: imageAlt };
  const indexed = !NOINDEX_PATHS.has(path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(indexed ? {} : { robots: { index: false, follow: true } }),
    alternates: indexed ? { canonical: url, languages: publicLanguages(path) } : { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: socialTitle,
      description,
      siteName: BRAND,
      locale: locale === "es" ? "es_CO" : "en_US",
      alternateLocale: locale === "es" ? ["en_US"] : ["es_CO"],
      images: [image],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [image] },
  };
}

export interface LandingGraphInput {
  locale: AppLocale;
  description: string;
  features: string[];
  questions: { question: string; answer: string }[];
}

export function landingGraph({ locale, description, features, questions }: LandingGraphInput) {
  const base = new URL("/", env.NEXT_PUBLIC_APP_URL).toString();
  const page = publicUrl("/", locale);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}#organization`,
        name: BRAND,
        url: base,
        logo: new URL("/icon-512.png", base).toString(),
        email: env.NEXT_PUBLIC_CONTACT_EMAIL,
      },
      {
        "@type": "WebSite",
        "@id": `${base}#website`,
        url: base,
        name: BRAND,
        inLanguage: ["en", "es"],
        publisher: { "@id": `${base}#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${base}#app`,
        name: BRAND,
        description,
        url: page,
        image: ogImageUrl(locale),
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
        inLanguage: ["en", "es"],
        isAccessibleForFree: true,
        featureList: features,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${base}#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${page}#faq`,
        inLanguage: locale,
        mainEntity: questions.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}
