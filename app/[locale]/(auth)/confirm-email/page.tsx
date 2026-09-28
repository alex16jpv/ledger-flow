import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ConfirmNewEmailLinkView } from "@/features/auth/components/EmailLinkView";
import { isEnabled } from "@/lib/flags";
import { isAppLocale } from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/confirm-email">): Promise<Metadata> {
  const { locale: raw } = await params;
  const t = await getTranslations({ locale: isAppLocale(raw) ? raw : "en", namespace: "auth" });
  return { title: t("confirmNewEmail.title"), robots: { index: false, follow: false } };
}

export default function ConfirmEmailPage() {
  if (!isEnabled("emailVerification")) notFound();
  return <ConfirmNewEmailLinkView />;
}
