"use client";

import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";

interface StatsRowProps {
  totalBalance: number;
  accountCount: number;
  income: number;
  spent: number;
}

export function StatsRow({ totalBalance, accountCount, income, spent }: StatsRowProps) {
  const t = useTranslations("home");
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card>
        <Stat
          label={t("totalBalance")}
          value={<Amount value={totalBalance} signed={false} size="lg" />}
          delta={{ direction: "flat", label: t("accountsCount", { count: accountCount }) }}
        />
      </Card>
      <Card>
        <Stat
          label={t("incomeThisMonth")}
          value={<Amount value={income} kind="income" size="lg" />}
        />
      </Card>
      <Card className="hidden sm:block">
        <Stat
          label={t("estimatedSavings")}
          value={<Amount value={income - spent} signed={false} size="lg" />}
          delta={{ direction: "flat", label: t("incomeMinusSpending") }}
        />
      </Card>
    </section>
  );
}
