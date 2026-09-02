"use client";

import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export interface PeriodSummaryProps {
  periodLabel: string;
  spent: number | null;
  income: number | null;
  count: number | null;
}

export function PeriodSummary({ periodLabel, spent, income, count }: PeriodSummaryProps) {
  const t = useTranslations("transactions.list");
  return (
    <Card className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs font-medium tracking-[0.04em] text-text-3 uppercase">
          {t("spentIn", { period: periodLabel })}
        </span>
        {spent === null ? (
          <Skeleton className="h-6 w-28" />
        ) : (
          <Amount value={spent} signed={false} size="lg" className="text-xl" />
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-xs font-medium tracking-[0.04em] text-text-3 uppercase">
          {t("income")}
        </span>
        {income === null ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <Amount value={income} kind="income" size="sm" />
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-xs font-medium tracking-[0.04em] text-text-3 uppercase">
          {t("count")}
        </span>
        {count === null ? (
          <Skeleton className="h-5 w-8" />
        ) : (
          <span className="text-sm font-semibold tabular-nums">{count}</span>
        )}
      </div>
    </Card>
  );
}
