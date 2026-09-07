"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useMoney } from "@/lib/i18n/useMoney";
import type { Budget } from "@/types/api";

export interface PeriodAmountCardProps {
  budget: Budget;
  periodLabel: string;
  pending: boolean;
  onChange: () => void;
  onSkip: () => void;
  onRemove: () => void;
}

export function PeriodAmountCard({
  budget,
  periodLabel,
  pending,
  onChange,
  onSkip,
  onRemove,
}: PeriodAmountCardProps) {
  const t = useTranslations("budgets.detail");
  const money = useMoney();
  const text = budget.hasOverride
    ? budget.amount === 0
      ? t("skipped", { period: periodLabel })
      : t("adjustedTo", { period: periodLabel, amount: money.format(budget.amount) })
    : t("usesBase", { period: periodLabel });

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-md font-semibold">{t("periodAmount")}</h2>
        <span className="text-sm text-text-3">
          {t("base", { amount: money.format(budget.baseAmount) })}
        </span>
      </div>
      <p className="text-sm text-text-2">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={pending} onClick={onChange}>
          <Pencil aria-hidden="true" className="size-4" />
          {t("change")}
        </Button>
        {budget.amount !== 0 && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={onSkip}>
            {t("skip")}
          </Button>
        )}
        {budget.hasOverride && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={onRemove}>
            {t("remove")}
          </Button>
        )}
      </div>
    </Card>
  );
}
