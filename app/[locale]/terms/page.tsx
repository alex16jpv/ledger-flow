import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/public/LegalPage";
import { PublicFrame } from "@/components/public/PublicFrame";
import { env } from "@/lib/env";
import { isAppLocale } from "@/lib/i18n/routing";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : "en";
  const t = await getTranslations({ locale, namespace: "public.terms" });
  return publicMetadata("/terms", locale, {
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function TermsPage() {
  const t = await getTranslations("public.terms");
  const plain = (
    key: "serviceBody" | "accountBody" | "useBody" | "availabilityBody" | "changesBody",
  ) => <p>{t(key)}</p>;
  return (
    <PublicFrame>
      <LegalPage
        title={t("title")}
        intro={t("intro")}
        sections={[
          { title: t("serviceTitle"), body: plain("serviceBody") },
          { title: t("accountTitle"), body: plain("accountBody") },
          { title: t("useTitle"), body: plain("useBody") },
          { title: t("availabilityTitle"), body: plain("availabilityBody") },
          { title: t("changesTitle"), body: plain("changesBody") },
          {
            title: t("contactTitle"),
            body: (
              <p>
                {t.rich("contactBody", {
                  address: env.NEXT_PUBLIC_CONTACT_EMAIL,
                  email: (chunks) => (
                    <a
                      href={`mailto:${env.NEXT_PUBLIC_CONTACT_EMAIL}`}
                      className="font-medium text-brand-text"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            ),
          },
        ]}
      />
    </PublicFrame>
  );
}
