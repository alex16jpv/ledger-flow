"use client";

import { ChartPie } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Projected } from "@/components/ui/Projected";
import { Tile } from "@/components/ui/Tile";
import { Link } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Budget, Category } from "@/types/api";

import { budgetStatus } from "../hooks";

interface BudgetsSectionProps {
  budgets: readonly Budget[];
  categories: ReadonlyMap<string, Category>;
  now: Date;
}

export function BudgetsSection({ budgets, categories, now }: BudgetsSectionProps) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const outbox = useOutbox();
  const money = useMoney();
  if (budgets.length === 0) return null;
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-md font-semibold">{t("budgets")}</h2>
        <Link href="/budgets" className="text-sm font-medium text-brand-text">
          {tc("seeAll")}
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {budgets.map((budget) => {
          const category =
            budget.categoryIds.length === 1
              ? categories.get(budget.categoryIds[0] ?? "")
              : undefined;
          const status = budgetStatus(budget, now);
          return (
            <li key={budget.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-center gap-3">
                <Tile size="sm" color={budget.color}>
                  {category ? (
                    <CategoryIcon icon={category.icon} size="sm" />
                  ) : (
                    <ChartPie {...iconProps("sm")} />
                  )}
                </Tile>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{budget.name}</span>
                <span className="text-sm text-text-2 tabular-nums">
                  <Projected when={outbox.projected.budgets}>
                    <Amount value={budget.spent} signed={false} size="sm" />
                  </Projected>{" "}
                  <span className="text-text-3">
                    {t("budgetOf", { amount: money.format(budget.amount) })}
                  </span>
                </span>
              </div>
              <Projected when={outbox.projected.budgets} align="center" className="w-full">
                <Progress
                  value={budget.spent}
                  max={budget.amount}
                  thin
                  color={budget.color}
                  label={budget.name}
                  className="flex-1"
                />
              </Projected>
              <span className="text-xs text-text-3">
                {status.kind === "over"
                  ? t("budgetOver", { amount: money.format(status.by) })
                  : status.kind === "warn"
                    ? t("budgetWarn", { percent: status.percent, days: status.daysLeft })
                    : t("budgetLeft", { amount: money.format(status.left) })}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
