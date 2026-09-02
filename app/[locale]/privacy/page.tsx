import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/public/LegalPage";
import { PublicFrame } from "@/components/public/PublicFrame";
import { env } from "@/lib/env";
import { isAppLocale } from "@/lib/i18n/routing";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : "en";
  const t = await getTranslations({ locale, namespace: "public.privacy" });
  return publicMetadata("/privacy", locale, {
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PrivacyPage() {
  const t = await getTranslations("public.privacy");
  return (
    <PublicFrame>
      <LegalPage
        title={t("title")}
        intro={t("intro")}
        sections={[
          {
            title: t("storeTitle"),
            body: (
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("store1")}</li>
                <li>{t("store2")}</li>
                <li>{t("store3")}</li>
              </ul>
            ),
          },
          { title: t("whyTitle"), body: <p>{t("whyBody")}</p> },
          { title: t("rightsTitle"), body: <p>{t("rightsBody")}</p> },
          {
            id: "data-processing",
            title: t("processingTitle"),
            body: <p>{t("processingBody")}</p>,
          },
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
