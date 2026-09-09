import { ChartPie, Sparkles, WifiOff, Zap } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { GoToAppIfSignedIn } from "@/components/public/GoToAppIfSignedIn";
import { JsonLd } from "@/components/public/JsonLd";
import { PhoneMock } from "@/components/public/PhoneMock";
import { PublicFrame } from "@/components/public/PublicFrame";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tile } from "@/components/ui/Tile";
import { Link } from "@/lib/i18n/navigation";
import { isAppLocale } from "@/lib/i18n/routing";
import { iconProps } from "@/lib/icons/sizes";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : "en";
  const t = await getTranslations({ locale, namespace: "public.landing" });
  return publicMetadata("/", locale, {
    title: t("metaTitle"),
    description: t("metaDescription"),
    absoluteTitle: true,
  });
}

export default async function LandingPage() {
  const t = await getTranslations("public.landing");
  const locale = await getLocale();
  const why = [
    { icon: Zap, color: "AMBER" as const, title: t("why1Title"), body: t("why1Body") },
    { icon: ChartPie, color: "INDIGO" as const, title: t("why2Title"), body: t("why2Body") },
    { icon: WifiOff, color: "TEAL" as const, title: t("why3Title"), body: t("why3Body") },
  ];
  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];
  return (
    <PublicFrame>
      <GoToAppIfSignedIn />
      <JsonLd
        locale={locale}
        name={t("metaTitle").split(" · ")[0] ?? ""}
        description={t("metaDescription")}
      />
      <section
        aria-labelledby="hero-title"
        className="mx-auto grid w-full max-w-(--content-max) gap-10 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center md:px-8 md:py-16"
      >
        <div className="flex flex-col items-start gap-5">
          <Badge tone="brand">
            <Sparkles aria-hidden="true" />
            {t("badge")}
          </Badge>
          <h1 id="hero-title" className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-[52ch] text-lg text-text-2">{t("lede")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={buttonClasses({ size: "lg" })}>
              {t("ctaPrimary")}
            </Link>
            <Link href="/login" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              {t("ctaSecondary")}
            </Link>
          </div>
          <p className="text-sm text-text-3">{t("trust")}</p>
        </div>
        <div aria-label={t("phoneLabel")} role="img">
          <PhoneMock />
        </div>
      </section>
      <section
        id="features"
        aria-labelledby="why-title"
        className="mx-auto flex w-full max-w-(--content-max) flex-col gap-6 px-4 py-10 sm:px-6 md:px-8"
      >
        <div className="flex flex-col gap-1 text-center">
          <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
            {t("whyEyebrow")}
          </span>
          <h2 id="why-title" className="text-2xl font-semibold tracking-[-0.02em]">
            {t("whyTitle")}
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {why.map(({ icon: Icon, color, title, body }) => (
            <Card key={title} className="flex flex-col gap-3">
              <Tile size="lg" color={color}>
                <Icon {...iconProps("lg")} />
              </Tile>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-text-2">{body}</p>
            </Card>
          ))}
        </div>
      </section>
      <section
        id="how"
        aria-labelledby="how-title"
        className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-10 sm:px-6"
      >
        <div className="flex flex-col gap-1 text-center">
          <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
            {t("howEyebrow")}
          </span>
          <h2 id="how-title" className="text-2xl font-semibold tracking-[-0.02em]">
            {t("howTitle")}
          </h2>
        </div>
        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-text">
                {index + 1}
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">{step.title}</span>
                <span className="text-sm text-text-2">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex justify-center">
          <Link href="/register" className={buttonClasses({ size: "lg" })}>
            {t("ctaFinal")}
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}
