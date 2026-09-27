import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ResetLinkView } from "@/features/auth/components/ResetLinkView";
import { isEnabled } from "@/lib/flags";
import { isAppLocale } from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset">): Promise<Metadata> {
  const { locale: raw } = await params;
  const t = await getTranslations({ locale: isAppLocale(raw) ? raw : "en", namespace: "auth" });
  return { title: t("reset.linkTitle"), robots: { index: false, follow: false } };
}

export default function ResetPage() {
  if (!isEnabled("forgotPassword")) notFound();
  return <ResetLinkView />;
}
