import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export interface LegalSection {
  id?: string;
  title: string;
  body: ReactNode;
}

export async function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  const t = await getTranslations("public.legal");
  const locale = await getLocale();
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(`${t("updated")}T12:00:00Z`),
  );
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
          {t("eyebrow", { date: updated })}
        </span>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="text-text-2">{intro}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} id={section.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <div className="text-text-2">{section.body}</div>
        </section>
      ))}
    </article>
  );
}
