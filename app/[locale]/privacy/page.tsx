import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LegalPage } from "@/components/public/LegalPage";
import { PublicFrame } from "@/components/public/PublicFrame";
import { env } from "@/lib/env";
import { isAppLocale } from "@/lib/i18n/routing";
import { CURRENT_POLICY } from "@/lib/legal";
import { publicMetadata } from "@/lib/seo";

const TURNSTILE_ADDENDUM = "https://www.cloudflare.com/turnstile-privacy-policy/";
const SIC = "https://www.sic.gov.co";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : "en";
  const t = await getTranslations({ locale, namespace: "public" });
  return publicMetadata("/privacy", locale, {
    title: t("privacy.metaTitle"),
    description: t("privacy.metaDescription"),
    imageAlt: t("seo.ogAlt"),
  });
}

const linkTo = (href: string) =>
  function LinkedText(chunks: ReactNode) {
    return (
      <a href={href} className="font-medium text-brand-text">
        {chunks}
      </a>
    );
  };

const list = (items: ReactNode[]) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

export default async function PrivacyPage() {
  const t = await getTranslations("public.privacy");
  const locale = await getLocale();
  const effective = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(`${CURRENT_POLICY.effective}T12:00:00Z`),
  );
  const email = linkTo(`mailto:${env.NEXT_PUBLIC_CONTACT_EMAIL}`);
  const address = env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <PublicFrame path="/privacy">
      <LegalPage
        title={t("title")}
        intro={t("intro")}
        updated={CURRENT_POLICY.effective}
        sections={[
          { title: t("controllerTitle"), body: <p>{t("controllerBody")}</p> },
          {
            title: t("storeTitle"),
            body: list([
              t("store1"),
              t("store2"),
              t("store3"),
              t("store4"),
              t("store5"),
              t("store6"),
            ]),
          },
          { title: t("sharedTitle"), body: list([t("shared1"), t("shared2"), t("shared3")]) },
          { title: t("whyTitle"), body: <p>{t("whyBody")}</p> },
          {
            title: t("providersTitle"),
            body: (
              <div className="flex flex-col gap-2">
                <p>{t("providersIntro")}</p>
                {list([
                  t("provider1"),
                  t("provider2"),
                  t("provider3"),
                  t("provider4"),
                  t.rich("provider5", { addendum: linkTo(TURNSTILE_ADDENDUM) }),
                ])}
                <p>{t("providersWhere")}</p>
              </div>
            ),
          },
          { title: t("deviceTitle"), body: <p>{t("deviceBody")}</p> },
          {
            title: t("keepTitle"),
            body: list([t("keep1"), t("keep2"), t("keep3"), t("keep4")]),
          },
          {
            title: t("rightsTitle"),
            body: (
              <div className="flex flex-col gap-2">
                <p>{t("rightsBody")}</p>
                <p>{t("rightsHow")}</p>
                <p>{t.rich("rightsAuthority", { sic: linkTo(SIC) })}</p>
              </div>
            ),
          },
          { title: t("securityTitle"), body: <p>{t("securityBody")}</p> },
          { title: t("changesTitle"), body: <p>{t("changesBody")}</p> },
          {
            id: "data-processing",
            title: t("processingTitle"),
            body: <p>{t.rich("processingBody", { email, address, date: effective })}</p>,
          },
          {
            title: t("contactTitle"),
            body: <p>{t.rich("contactBody", { email, address })}</p>,
          },
        ]}
      />
    </PublicFrame>
  );
}
