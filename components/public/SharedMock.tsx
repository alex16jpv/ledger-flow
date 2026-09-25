import { User, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Avatar } from "@/components/shell/Avatar";
import { Card } from "@/components/ui/Card";
import { RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { formatMoney } from "@/lib/format/money";
import { formatLocaleFor } from "@/lib/i18n/format-locale";
import { iconProps } from "@/lib/icons/sizes";
import type { ColorToken } from "@/lib/theme/feature-color";

const CURRENCY = "COP";
const OWED_TO_YOU = 552_600;
const YOU_OWE = 60_000;

export async function SharedMock() {
  const t = await getTranslations("shared");
  const sample = await getTranslations("public.sharedMock");
  const locale = await getLocale();
  const money = (amount: number) =>
    formatMoney(amount, { currency: CURRENCY, locale: formatLocaleFor(locale, null) });
  const people: { name: string; color: ColorToken; groups: string; amount: number; owesYou: boolean }[] = [
    { name: "Beto Cano", color: "TEAL", groups: sample("trip"), amount: 526_300, owesYou: true },
    { name: "Ana Ruiz", color: "PINK", groups: sample("trip"), amount: 26_300, owesYou: true },
    { name: "Diego Pardo", color: "INDIGO", groups: sample("rent"), amount: 60_000, owesYou: false },
  ];
  const face =
    "inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[8px] px-2 text-sm font-medium text-text-2";
  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 rounded-[28px] border border-border-strong bg-bg p-4 shadow-3">
      <div className="grid grid-flow-col auto-cols-fr gap-0.5 rounded-md bg-surface-2 p-[3px]">
        <span className={`${face} bg-surface text-text shadow-1`}>
          <User {...iconProps("sm")} />
          {t("faces.people")}
        </span>
        <span className={face}>
          <Users {...iconProps("sm")} />
          {t("faces.groups")}
        </span>
      </div>
      <Card className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-3">{t("summary.owedToYou")}</span>
          <span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">
            {money(OWED_TO_YOU)}
          </span>
          <span className="text-sm text-text-3">{t("summary.counts", { open: 3, contacts: 23 })}</span>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="text-xs font-medium text-text-3">{t("summary.youOwe")}</span>
          <span className="text-xl font-semibold tabular-nums">{money(YOU_OWE)}</span>
        </div>
      </Card>
      <Card flush>
        {people.map((person) => (
          <div key={person.name} className={rowClasses()}>
            <Avatar name={person.name} color={person.color} />
            <RowBody>
              <RowTitle>
                <span>{person.name}</span>
              </RowTitle>
              <RowMeta items={[person.groups]} />
            </RowBody>
            <RowRight sub={person.owesYou ? t("people.owesYouWord") : t("people.youOweWord")}>
              <span className="font-medium tabular-nums">{money(person.amount)}</span>
            </RowRight>
          </div>
        ))}
      </Card>
    </div>
  );
}
