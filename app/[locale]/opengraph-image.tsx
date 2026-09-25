import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { isAppLocale } from "@/lib/i18n/routing";
import { BrandMark } from "@/lib/pwa/brand-icon";
import { BRAND_GREEN } from "@/lib/pwa/brand-mark";
import { OG_IMAGE_SIZE } from "@/lib/seo";

export const alt = "Ledger Flow";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

// Generated from copy and brand colors so the card follows the locale and never needs a hand-made PNG.
export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "public.landing" });
  const brand = await getTranslations({ locale, namespace: "metadata" });
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
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: BRAND_GREEN,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BrandMark size={32} />
        </div>
        {brand("title")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
          {t("title")}
        </div>
        <div style={{ fontSize: 30, color: "#4a5a58", maxWidth: 900 }}>{t("metaDescription")}</div>
      </div>
      <div style={{ fontSize: 22, color: "#4a5a58" }}>{t("trust")}</div>
    </div>,
    size,
  );
}
