"use client";

import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import type { Budget } from "@/types/api";

import type { MonthContext } from "../hooks";

interface HeroCardProps {
  month: MonthContext;
  spent: number;
  yesterdaySpent: number | null;
  globalBudget: Budget | null;
  onCreateBudget: () => void;
}

export function HeroCard({
  month,
  spent,
  yesterdaySpent,
  globalBudget,
  onCreateBudget,
}: HeroCardProps) {
  const t = useTranslations("home");
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
      <Amount value={spent} signed={false} size="hero" />
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
      {globalBudget && percent !== null ? (
        <div className="mt-1 flex items-center gap-3">
          <Progress
            value={globalBudget.spent}
            max={globalBudget.amount}
            marker={month.dayOfMonth / month.daysInMonth}
            color={globalBudget.color}
            label={globalBudget.name}
            className="flex-1"
          />
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
