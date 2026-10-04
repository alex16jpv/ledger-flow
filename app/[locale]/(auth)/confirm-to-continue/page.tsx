import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { isAppLocale } from "@/lib/i18n/routing";

import { ConfirmToContinueScreen } from "./ConfirmToContinueScreen";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/confirm-to-continue">): Promise<Metadata> {
  const { locale: raw } = await params;
  const t = await getTranslations({ locale: isAppLocale(raw) ? raw : "en", namespace: "auth" });
  return { title: t("confirmRequired.title"), robots: { index: false, follow: false } };
}

export default function ConfirmToContinuePage() {
  return <ConfirmToContinueScreen />;
}
