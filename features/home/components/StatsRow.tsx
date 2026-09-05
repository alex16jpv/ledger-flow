"use client";

import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { Projected } from "@/components/ui/Projected";
import { Stat } from "@/components/ui/Stat";
import { useOutbox } from "@/lib/local/outbox/useOutbox";

interface StatsRowProps {
  totalBalance: number;
  accountCount: number;
  income: number;
  spent: number;
}

export function StatsRow({ totalBalance, accountCount, income, spent }: StatsRowProps) {
  const t = useTranslations("home");
  const outbox = useOutbox();
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card>
        <Stat
          label={t("totalBalance")}
          value={
            <Projected when={outbox.projected.balances}>
              <Amount value={totalBalance} signed={false} size="lg" />
            </Projected>
          }
          delta={{ direction: "flat", label: t("accountsCount", { count: accountCount }) }}
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
      <Card className="hidden sm:block">
        <Stat
          label={t("estimatedSavings")}
          value={
            <Projected when={outbox.projected.spending}>
              <Amount value={income - spent} signed={false} size="lg" />
            </Projected>
          }
          delta={{ direction: "flat", label: t("incomeMinusSpending") }}
        />
      </Card>
    </section>
  );
}
