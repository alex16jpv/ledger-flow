import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, Suspense } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { LanguageChip } from "./LanguageChoice";

export function AuthFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-5 px-4 py-8">
        <div className="flex items-center justify-between gap-2 pb-2">
          <span aria-hidden="true" className="w-16" />
          <span className="flex items-center gap-2 text-md font-semibold">
            <span
              aria-hidden="true"
              className="grid size-[26px] place-items-center rounded-lg bg-brand text-on-brand"
            >
              <Layers {...iconProps("sm")} />
            </span>
            {t("appName")}
          </span>
          {/* The chip reads the query string so a `?reauth=1` login keeps it (§8.4, F-02). */}
          <Suspense fallback={<span className="w-16" />}>
            <LanguageChip />
          </Suspense>
        </div>
        {children}
      </div>
    </main>
  );
}

export function AuthHeading({ title, subtitle }: { title: ReactNode; subtitle: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="text-text-2">{subtitle}</p>
    </div>
  );
}
