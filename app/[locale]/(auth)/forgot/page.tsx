import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ForgotView } from "@/features/auth/components/ForgotView";
import { isEnabled } from "@/lib/flags";
import { isAppLocale } from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forgot">): Promise<Metadata> {
  const { locale: raw } = await params;
  const t = await getTranslations({ locale: isAppLocale(raw) ? raw : "en", namespace: "auth" });
  return { title: t("forgot.title"), robots: { index: false, follow: false } };
}

export default function ForgotPage() {
  if (!isEnabled("forgotPassword")) notFound();
  return <ForgotView />;
}
