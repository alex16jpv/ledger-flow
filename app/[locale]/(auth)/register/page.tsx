import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { RegisterView } from "@/features/auth/components/RegisterView";
import { isAppLocale } from "@/lib/i18n/routing";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/register">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : "en";
  const meta = await getTranslations({ locale, namespace: "public.seo" });
  return publicMetadata("/register", locale, {
    title: meta("registerTitle"),
    description: meta("registerDescription"),
    imageAlt: meta("ogAlt"),
  });
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterView />
    </Suspense>
  );
}
