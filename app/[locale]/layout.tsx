import "../globals.css";

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { geistMono, geistSans } from "@/app/fonts";
import { Analytics } from "@/lib/analytics/Analytics";
import { env } from "@/lib/env";
import { routing } from "@/lib/i18n";
import { DEFAULT_PALETTE } from "@/lib/theme";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    title: { default: t("title"), template: t("template") },
    description: t("description"),
  };
}

// Standalone PWA: draw under the notch and let the theme script set theme-color from the live --bg token.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      data-palette={DEFAULT_PALETTE}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script async src="/theme-init.js" nonce={nonce} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
