import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { isAppLocale } from "@/lib/i18n/routing";

export const alt = "Ledger Flow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated from copy and brand colors so the card follows the locale and never needs a hand-made PNG.
export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = isAppLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: safeLocale, namespace: "public.landing" });
  const brand = await getTranslations({ locale: safeLocale, namespace: "metadata" });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #e6f4f1 0%, #f9feff 70%)",
        color: "#0f1b1a",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 600 }}
      >
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "#0c6b62" }} />
        {brand("title")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
          {t("title")}
        </div>
        <div style={{ fontSize: 30, color: "#4a5a58", maxWidth: 900 }}>{t("metaDescription")}</div>
      </div>
      <div style={{ fontSize: 26, color: "#4a5a58" }}>{t("trust")}</div>
    </div>,
    size,
  );
}
