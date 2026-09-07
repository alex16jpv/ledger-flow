"use client";

import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";

import { ADD_HREF } from "@/components/shell/nav";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Bars } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Projected } from "@/components/ui/Projected";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Budget } from "@/types/api";

import { type DayBar, type MonthContext } from "../hooks";

interface HeroCardProps {
  month: MonthContext;
  spent: number;
  yesterdaySpent: number | null;
  globalBudget: Budget | null;
  bars: readonly DayBar[];
  onCreateBudget: () => void;
}

export function HeroCard({
  month,
  spent,
  yesterdaySpent,
  globalBudget,
  bars,
  onCreateBudget,
}: HeroCardProps) {
  const t = useTranslations("home");
  const pace = useTranslations("budgets.pace");
  const outbox = useOutbox();
  const money = useMoney();
  const dates = useDates();
  const dailyAverage = month.dayOfMonth > 0 ? spent / month.dayOfMonth : 0;
  const percent =
    globalBudget && globalBudget.amount > 0
      ? Math.round((globalBudget.spent / globalBudget.amount) * 100)
      : null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
          {t("spending", { month: dates.formatMonth(month.reference).split(" ")[0] ?? "" })}
        </span>
        <Badge tone="outline">
          <Calendar aria-hidden="true" />
          {t("dayOf", { day: month.dayOfMonth, total: month.daysInMonth })}
        </Badge>
      </div>
      <Projected when={outbox.projected.spending}>
        <Amount value={spent} signed={false} size="hero" />
      </Projected>
      {spent === 0 && (
        <p className="text-sm text-text-3">
          {t("empty.month.title")}{" "}
          <Link href={ADD_HREF} className="font-medium text-brand-text">
            {t("empty.month.cta")}
          </Link>
        </p>
      )}
      <p className="text-sm text-text-2">
        {t("dailyAverage")}{" "}
        <b className="font-medium text-text tabular-nums">
          {money.format(money.round(dailyAverage))}
        </b>
        {yesterdaySpent !== null && (
          <>
            {" · "}
            <span className="text-text-3">
              {t("yesterdaySpent", { amount: money.format(yesterdaySpent) })}
            </span>
          </>
        )}
      </p>
      <Projected when={outbox.projected.spending} align="center" className="mt-1 w-full">
        <Bars bars={bars} label={t("spendingPerDay")} className="flex-1" />
      </Projected>
      {globalBudget && percent !== null ? (
        <div className="mt-1 flex items-center gap-3">
          <Projected when={outbox.projected.budgets} align="center" className="flex-1">
            <Progress
              value={globalBudget.spent}
              max={globalBudget.amount}
              marker={month.dayOfMonth / month.daysInMonth}
              markerLabel={pace("tooltip", {
                day: month.dayOfMonth,
                days: month.daysInMonth,
                percent: Math.round((month.dayOfMonth / month.daysInMonth) * 100),
              })}
              color={globalBudget.color}
              label={globalBudget.name}
              className="flex-1"
            />
          </Projected>
          <span className="text-sm whitespace-nowrap text-text-2">
            {t("budgetProgress", { percent })}
          </span>
        </div>
      ) : (
        <Button variant="soft" size="sm" className="self-start" onClick={onCreateBudget}>
          {t("createMonthlyBudget")}
        </Button>
      )}
    </Card>
  );
}
