"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Progress } from "@/components/ui/Progress";
import { Projected } from "@/components/ui/Projected";
import { Stat } from "@/components/ui/Stat";
import { Tile } from "@/components/ui/Tile";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Budget } from "@/types/api";

import { budgetProgress } from "../progress";

const DAY_MS = 86_400_000;

export interface BudgetHeroProps {
  budget: Budget;
  icon: ReactNode;
  now: Date;
}

export function BudgetHero({ budget, icon, now }: BudgetHeroProps) {
  const t = useTranslations("budgets");
  const outbox = useOutbox();
  const money = useMoney();
  const dates = useDates();
  const progress = budgetProgress(budget, now);
  const from = new Date(budget.periodFrom);
  const to = new Date(budget.periodTo);
  const range = dates.formatRange(from, new Date(to.getTime() - 1));
  const elapsedDays = Math.max(
    1,
    Math.ceil((Math.min(now.getTime(), to.getTime()) - from.getTime()) / DAY_MS),
  );
  const pace = budget.spent / elapsedDays;
  const custom = budget.periodType === "CUSTOM";

  return (
    <Card className={cn("flex flex-col gap-3", budget.archivedAt && "opacity-70")}>
      <div className="flex items-start gap-3">
        <Tile size="lg" color={budget.color}>
          {icon}
        </Tile>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg font-semibold">{budget.name}</span>
            {budget.hasOverride && (
              <Badge tone="outline">
                <Pencil aria-hidden="true" />
                {t("list.adjusted")}
              </Badge>
            )}
          </span>
          <span className="text-sm text-text-3">
            {t("list.periodRange", { period: t(`periodTypes.${budget.periodType}`), range })}
            {" · "}
            {t("detail.since", { month: dates.formatMonth(new Date(budget.effectiveFrom)) })}
          </span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <Projected when={outbox.projected.budgets}>
          <Amount value={budget.spent} signed={false} size="hero" />
        </Projected>
        <span className="text-sm text-text-3">
          {t("list.of", { amount: money.format(budget.amount) })}
        </span>
      </div>
      <Projected when={outbox.projected.budgets} align="center" className="w-full">
        <Progress
          value={budget.spent}
          max={budget.amount}
          marker={progress.elapsed}
          color={budget.color}
          label={budget.name}
          className="flex-1"
        />
      </Projected>
      <div className="grid grid-cols-3 gap-3 pt-1">
        <Stat
          label={t("detail.remaining")}
          value={
            <Projected when={outbox.projected.budgets}>
              <Amount
                value={progress.remaining}
                signed={false}
                size="base"
                className={cn("text-xl font-semibold", progress.remaining < 0 && "text-danger")}
              />
            </Projected>
          }
        />
        <Stat
          label={t("detail.pace")}
          value={
            <span className="text-xl font-semibold tracking-[-0.02em]">
              {t("detail.paceValue", { amount: money.format(money.round(pace)) })}
            </span>
          }
        />
        <Stat
          label={t("detail.left")}
          value={
            <span className="text-xl font-semibold tracking-[-0.02em]">
              {custom && (budget.expired || progress.status === "ended")
                ? t("detail.ended")
                : t("detail.leftDays", { days: progress.daysLeft })}
            </span>
          }
        />
      </div>
    </Card>
  );
}
