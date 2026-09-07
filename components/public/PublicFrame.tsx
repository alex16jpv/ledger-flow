import { Globe, Layers } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/Button";
import { env } from "@/lib/env";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

// Static shell for the indexable pages: no sidebar, no tabs, no client providers.
export async function PublicFrame({ children }: { children: ReactNode }) {
  const t = await getTranslations("public");
  const locale = await getLocale();
  const otherLocale = locale === "es" ? "en" : "es";
  const year = new Date().getFullYear();
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <header className="mx-auto flex w-full max-w-(--content-max) items-center gap-3 px-4 py-4 sm:px-6 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-md font-semibold whitespace-nowrap">
          <span className="grid size-8 place-items-center rounded-[10px] bg-brand text-on-brand">
            <Layers {...iconProps("sm")} />
          </span>
          {t("footer.copyright", { year }).replace(/^© \d+ /, "")}
        </Link>
        <nav
          aria-label={t("nav.features")}
          className="hidden items-center gap-4 text-sm text-text-2 sm:flex"
        >
          <a href="#features" className="hover:text-text">
            {t("nav.features")}
          </a>
          <a href="#how" className="hover:text-text">
            {t("nav.how")}
          </a>
          <Link href="/privacy" className="hover:text-text">
            {t("nav.privacy")}
          </Link>
        </nav>
        <span className="flex-1" />
        <Link
          href="/"
          locale={otherLocale}
          aria-label={t("nav.language")}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong px-3 text-sm font-medium uppercase"
        >
          <Globe {...iconProps("sm")} />
          {otherLocale}
        </Link>
        <Link href="/login" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          {t("nav.signIn")}
        </Link>
        <Link href="/register" className={buttonClasses({ size: "sm" })}>
          {t("nav.getStarted")}
        </Link>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-(--content-max) flex-col gap-3 border-t border-border px-4 py-8 text-xs text-text-3 sm:px-6 md:px-8">
        <span>{t("footer.copyright", { year })}</span>
        <nav aria-label={t("footer.privacy")} className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/privacy" className="hover:text-text">
            {t("footer.privacy")}
          </Link>
          <Link href="/terms" className="hover:text-text">
            {t("footer.terms")}
          </Link>
          <Link href="/privacy#data-processing" className="hover:text-text">
            {t("footer.dataProcessing")}
          </Link>
          <a href={`mailto:${env.NEXT_PUBLIC_CONTACT_EMAIL}`} className="hover:text-text">
            {t("footer.contact")}
          </a>
        </nav>
        <span className="flex items-center gap-2">
          <Globe {...iconProps("sm")} />
          <Link
            href="/"
            locale="en"
            className="hover:text-text"
            aria-current={locale === "en" ? "true" : undefined}
          >
            {t("footer.english")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/"
            locale="es"
            className="hover:text-text"
            aria-current={locale === "es" ? "true" : undefined}
          >
            {t("footer.spanish")}
          </Link>
        </span>
      </footer>
    </div>
  );
}
