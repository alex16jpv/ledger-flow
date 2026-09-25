import {
  ChartColumn,
  ChartPie,
  CircleCheck,
  Sparkles,
  Users,
  Wallet,
  WifiOff,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { GoToAppIfSignedIn } from "@/components/public/GoToAppIfSignedIn";
import { JsonLd } from "@/components/public/JsonLd";
import { PhoneMock } from "@/components/public/PhoneMock";
import { PublicFrame } from "@/components/public/PublicFrame";
import { SharedMock } from "@/components/public/SharedMock";
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
  const t = await getTranslations({ locale, namespace: "public" });
  return publicMetadata("/", locale, {
    title: t("landing.metaTitle"),
    description: t("landing.metaDescription"),
    imageAlt: t("seo.ogAlt"),
    absoluteTitle: true,
  });
}

export default async function LandingPage() {
  const t = await getTranslations("public.landing");
  const locale = await getLocale();
  const why = [
    { icon: Zap, color: "AMBER" as const, title: t("why1Title"), body: t("why1Body") },
    { icon: ChartPie, color: "INDIGO" as const, title: t("why2Title"), body: t("why2Body") },
    { icon: Users, color: "TEAL" as const, title: t("why3Title"), body: t("why3Body") },
    { icon: ChartColumn, color: "GREEN" as const, title: t("why4Title"), body: t("why4Body") },
    { icon: Wallet, color: "BLUE" as const, title: t("why5Title"), body: t("why5Body") },
    { icon: WifiOff, color: "PURPLE" as const, title: t("why6Title"), body: t("why6Body") },
  ];
  const sharedPoints = [t("shared1"), t("shared2"), t("shared3"), t("shared4")];
  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];
  const questions = ([1, 2, 3, 4, 5, 6] as const).map((n) => ({
    question: t(`faq${n}Q`),
    answer: t(`faq${n}A`),
  }));
  return (
    <PublicFrame>
      <GoToAppIfSignedIn />
      <JsonLd
        locale={isAppLocale(locale) ? locale : "en"}
        description={t("metaDescription")}
        features={why.map(({ title }) => title)}
        questions={questions}
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
          <p className="mx-auto mt-3 max-w-[62ch] text-text-2">{t("whyLede")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
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
        id="shared"
        aria-labelledby="shared-title"
        className="mx-auto grid w-full max-w-(--content-max) grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:px-8"
      >
        <div className="flex flex-col items-start gap-4">
          <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
            {t("sharedEyebrow")}
          </span>
          <h2 id="shared-title" className="text-2xl font-semibold tracking-[-0.02em]">
            {t("sharedTitle")}
          </h2>
          <p className="text-text-2">{t("sharedBody")}</p>
          <ul className="flex flex-col gap-3">
            {sharedPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-text-2">
                <CircleCheck {...iconProps("sm")} className="mt-0.5 shrink-0 text-brand-text" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div aria-label={t("sharedLabel")} role="img">
          <SharedMock />
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
      <section
        id="faq"
        aria-labelledby="faq-title"
        className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-10 sm:px-6"
      >
        <div className="flex flex-col gap-1 text-center">
          <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
            {t("faqEyebrow")}
          </span>
          <h2 id="faq-title" className="text-2xl font-semibold tracking-[-0.02em]">
            {t("faqTitle")}
          </h2>
        </div>
        <div className="flex flex-col gap-5">
          {questions.map(({ question, answer }) => (
            <div key={question} className="flex flex-col gap-1">
              <h3 className="font-semibold">{question}</h3>
              <p className="text-text-2">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicFrame>
  );
}
