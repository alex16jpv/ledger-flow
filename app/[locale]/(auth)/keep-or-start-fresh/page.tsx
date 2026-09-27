import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { KeepOrStartFreshView } from "@/features/auth/components/KeepOrStartFreshView";
import { isAppLocale } from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/keep-or-start-fresh">): Promise<Metadata> {
  const { locale: raw } = await params;
  const t = await getTranslations({ locale: isAppLocale(raw) ? raw : "en", namespace: "auth" });
  return { title: t("keep.title"), robots: { index: false, follow: false } };
}

export default function KeepOrStartFreshPage() {
  return (
    <Suspense>
      <KeepOrStartFreshView />
    </Suspense>
  );
}
