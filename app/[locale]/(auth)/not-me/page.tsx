import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { NotMeLinkView } from "@/features/auth/components/EmailLinkView";
import { isEnabled } from "@/lib/flags";
import { isAppLocale } from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/not-me">): Promise<Metadata> {
  const { locale: raw } = await params;
  const t = await getTranslations({ locale: isAppLocale(raw) ? raw : "en", namespace: "auth" });
  return { title: t("notMe.title"), robots: { index: false, follow: false } };
}

export default function NotMePage() {
  if (!isEnabled("emailVerification")) notFound();
  return <NotMeLinkView />;
}
