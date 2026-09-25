"use client";

import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { Projected } from "@/components/ui/Projected";
import { Stat } from "@/components/ui/Stat";
import { fromCents, toCents } from "@/lib/local/derive/money";
import { useOutbox } from "@/lib/local/outbox/useOutbox";

interface StatsRowProps {
  have: number;
  owe: number;
  accountCount: number;
  income: number;
  spent: number;
}

export function StatsRow({ have, owe, accountCount, income, spent }: StatsRowProps) {
  const t = useTranslations("home");
  const ta = useTranslations("accounts.summary");
  const outbox = useOutbox();
  return (
    <section className="grid grid-cols-2 gap-3">
      <Card>
        <Stat
          label={ta("have")}
          value={
            <Projected when={outbox.projected.balances}>
              <Amount value={have} signed={false} size="lg" />
            </Projected>
          }
          delta={{ direction: "flat", label: t("accountsCount", { count: accountCount }) }}
        />
      </Card>
      <Card>
        <Stat
          label={ta("owe")}
          value={
            <Projected when={outbox.projected.balances}>
              <Amount value={owe} signed={false} size="lg" />
            </Projected>
          }
        />
      </Card>
      <Card>
        <Stat
          label={t("incomeThisMonth")}
          value={
            <Projected when={outbox.projected.spending}>
              <Amount value={income} kind="income" size="lg" />
            </Projected>
          }
        />
      </Card>
      <Card className="hidden min-[600px]:block">
        <Stat
          label={t("estimatedSavings")}
          value={
            <Projected when={outbox.projected.spending}>
              <Amount
                value={fromCents(toCents(income) - toCents(spent))}
                signed={false}
                size="lg"
              />
            </Projected>
          }
          delta={{ direction: "flat", label: t("incomeMinusSpending") }}
        />
      </Card>
    </section>
  );
}
