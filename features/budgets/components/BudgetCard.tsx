"use client";

import { Archive, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Progress } from "@/components/ui/Progress";
import { Projected } from "@/components/ui/Projected";
import { Tile } from "@/components/ui/Tile";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Budget } from "@/types/api";

import { budgetProgress } from "../progress";

export interface BudgetCardProps {
  budget: Budget;
  icon: ReactNode;
  now: Date;
  href: string;
  footer?: ReactNode;
  statusBadge?: ReactNode;
}

export function useBudgetStatusText() {
  const t = useTranslations("budgets.list.status");
  const money = useMoney();
  return (budget: Budget, now: Date): string => {
    const progress = budgetProgress(budget, now);
    const left = money.format(Math.abs(progress.remaining));
    switch (progress.status) {
      case "over":
        return t(progress.daysLeft === 0 ? "endedOver" : "over", { amount: left });
      case "ended":
        return t("ended", { amount: left });
      case "untouched":
        return t("untouched", { amount: left });
      case "fast":
        return t("fast", { amount: left });
      case "ok":
        return budget.periodType === "CUSTOM"
          ? t("custom", { amount: left, days: progress.daysLeft })
          : t("ok", { amount: left, days: progress.daysLeft });
    }
  };
}

export function BudgetCard({ budget, icon, now, href, footer, statusBadge }: BudgetCardProps) {
  const t = useTranslations("budgets");
  const outbox = useOutbox();
  const money = useMoney();
  const dates = useDates();
  const statusText = useBudgetStatusText();
  const progress = budgetProgress(budget, now);
  const range = dates.formatRange(
    new Date(budget.periodFrom),
    new Date(new Date(budget.periodTo).getTime() - 1),
  );
  const custom = budget.periodType === "CUSTOM";

  return (
    <Card className="relative flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Tile color={budget.color}>{icon}</Tile>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={href} className="truncate font-medium after:absolute after:inset-0">
              {budget.name}
            </Link>
            {statusBadge}
            {budget.hasOverride && (
              <Badge tone="outline">
                <Pencil aria-hidden="true" />
                {t("list.adjusted")}
              </Badge>
            )}
            {budget.archivedCategoryIds.length > 0 && (
              <Badge tone="warning">
                <Archive aria-hidden="true" />
                {t("list.archivedCategory")}
              </Badge>
            )}
            {custom && !statusBadge && (
              <Badge>
                {progress.status === "ended" || budget.expired
                  ? t("list.ended")
                  : t("list.endsIn", { days: progress.daysLeft })}
              </Badge>
            )}
          </span>
          <span className="text-sm text-text-3">
            {t("list.periodRange", { period: t(`periodTypes.${budget.periodType}`), range })}
          </span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <Projected when={outbox.projected.budgets}>
          <Amount value={budget.spent} signed={false} size="lg" />
        </Projected>
        <span className="text-sm text-text-3">
          {t("list.of", { amount: money.format(budget.amount) })}
        </span>
      </div>
      <Projected when={outbox.projected.budgets} align="center" className="w-full">
        <Progress
          value={budget.spent}
          max={budget.amount}
          color={budget.color}
          label={budget.name}
          className="flex-1"
        />
      </Projected>
      {footer ?? (
        <span className={cn("text-sm", progress.status === "over" ? "text-danger" : "text-text-2")}>
          {statusText(budget, now)}
        </span>
      )}
    </Card>
  );
}
