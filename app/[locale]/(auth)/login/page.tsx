import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LoginView } from "@/features/auth/components/LoginView";
import { isAppLocale } from "@/lib/i18n/routing";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : "en";
  const t = await getTranslations({ locale, namespace: "auth.login" });
  const meta = await getTranslations({ locale, namespace: "public.landing" });
  return publicMetadata("/login", locale, {
    title: t("submit"),
    description: meta("metaDescription"),
  });
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
