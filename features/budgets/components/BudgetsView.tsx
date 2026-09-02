"use client";

import { Archive, ChartPie, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Budget, Category } from "@/types/api";

import { useBudgetsQuery } from "../hooks";
import { BUDGET_PERIOD_TYPES, type BudgetPeriodType, isGlobalBudget } from "../progress";
import { currentMonthKey, monthReference, shiftMonthKey } from "../reference";
import { BudgetCard } from "./BudgetCard";
import { GlobalBudgetCard } from "./GlobalBudgetCard";

export interface BudgetsViewProps {
  monthKey: string;
  periodFilter: BudgetPeriodType | null;
  categories: ReadonlyMap<string, Category>;
  onMonthChange: (monthKey: string) => void;
  onPeriodFilterChange: (period: BudgetPeriodType | null) => void;
  onCreateGlobal: () => void;
  now?: Date;
}

const NEW_HREF = "/budgets/new";
const PAST_HREF = "/budgets/past";

export function budgetIcon(budget: Budget, categories: ReadonlyMap<string, Category>): ReactNode {
  const category =
    budget.categoryIds.length === 1 ? categories.get(budget.categoryIds[0] ?? "") : undefined;
  return category ? <CategoryIcon icon={category.icon} /> : <ChartPie {...iconProps("md")} />;
}

export function BudgetsView({
  monthKey,
  periodFilter,
  categories,
  onMonthChange,
  onPeriodFilterChange,
  onCreateGlobal,
  now = new Date(),
}: BudgetsViewProps) {
  const t = useTranslations();
  const dates = useDates();
  const { reference, iso } = monthReference(monthKey, dates.timeZone);
  const budgets = useBudgetsQuery({ reference: iso });
  const isCurrent = monthKey >= currentMonthKey(now, dates.timeZone);
  const all = budgets.data ?? [];
  const global = all.find((budget) => isGlobalBudget(budget) && budget.periodType === "MONTHLY");
  const rest = all
    .filter((budget) => budget !== global)
    .filter((budget) => periodFilter === null || budget.periodType === periodFilter)
    .sort((a, b) => b.spent / (b.amount || 1) - a.spent / (a.amount || 1));
  const showGlobalSlot = periodFilter === null || periodFilter === "MONTHLY";
  const detailHref = (budget: Budget) => `/budgets/${budget.id}?reference=${monthKey}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("budgets.list.title")}
        actions={
          <>
            <Link
              href={PAST_HREF}
              aria-label={t("budgets.list.past")}
              className={buttonClasses({ variant: "ghost", iconOnly: true, round: true })}
            >
              <Archive {...iconProps("md")} />
            </Link>
            <span className="md:hidden">
              <Link
                href={NEW_HREF}
                aria-label={t("budgets.list.new")}
                className={buttonClasses({ variant: "secondary", iconOnly: true, round: true })}
              >
                <Plus {...iconProps("md")} />
              </Link>
            </span>
            <span className="hidden md:inline-flex">
              <Link href={NEW_HREF} className={buttonClasses({})}>
                <Plus {...iconProps("sm")} />
                {t("budgets.list.new")}
              </Link>
            </span>
          </>
        }
      />
      <PeriodNav
        label={dates.formatMonth(reference)}
        previousLabel={t("budgets.list.previousMonth")}
        nextLabel={t("budgets.list.nextMonth")}
        nextDisabled={isCurrent}
        onPrevious={() => {
          onMonthChange(shiftMonthKey(monthKey, -1, dates.timeZone));
        }}
        onNext={() => {
          onMonthChange(shiftMonthKey(monthKey, 1, dates.timeZone));
        }}
      />
      <ChipRow role="group" aria-label={t("budgets.list.title")}>
        <Chip
          selected={periodFilter === null}
          onClick={() => {
            onPeriodFilterChange(null);
          }}
        >
          {t("budgets.list.all")}
        </Chip>
        {BUDGET_PERIOD_TYPES.map((period) => (
          <Chip
            key={period}
            selected={periodFilter === period}
            onClick={() => {
              onPeriodFilterChange(period);
            }}
          >
            {t(`budgets.periodTypes.${period}`)}
          </Chip>
        ))}
      </ChipRow>
      {budgets.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("common.loading")}>
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-2.5 w-40" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-1.5 w-full" />
          </Card>
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="flex flex-col gap-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-1.5 w-full" />
            </Card>
          ))}
        </div>
      ) : budgets.isError ? (
        <Empty
          tone="danger"
          icon={<ChartPie {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={t("states.error.body")}
          action={
            <Button
              onClick={() => {
                void budgets.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : all.length === 0 && isCurrent ? (
        <Empty
          icon={<ChartPie {...iconProps("lg")} />}
          title={t("budgets.list.empty.title")}
          body={t("budgets.list.empty.body")}
          action={<Button onClick={onCreateGlobal}>{t("budgets.list.empty.cta")}</Button>}
        />
      ) : (
        <>
          {showGlobalSlot &&
            (global ? (
              <GlobalBudgetCard budget={global} now={now} href={detailHref(global)} />
            ) : (
              isCurrent && (
                <button
                  type="button"
                  onClick={onCreateGlobal}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border-[1.5px] border-dashed border-border-strong px-4 py-5 text-center hover:bg-surface-2",
                    "focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none",
                  )}
                >
                  <span className="font-medium text-brand-text">
                    {t("budgets.list.createGlobal")}
                  </span>
                  <span className="text-sm text-text-3">{t("budgets.list.createGlobalHint")}</span>
                </button>
              )
            ))}
          {rest.length === 0 &&
            all.length > 0 &&
            periodFilter !== null &&
            !(showGlobalSlot && global) && (
              <p className="py-6 text-center text-sm text-text-3">
                {t("budgets.list.noneForFilter", {
                  period: t(`budgets.periodTypes.${periodFilter}`).toLocaleLowerCase(),
                })}
              </p>
            )}
          <div className="grid gap-3 md:grid-cols-2">
            {rest.map((budget) => (
              <div key={budget.id} className="relative">
                <BudgetCard
                  budget={budget}
                  icon={budgetIcon(budget, categories)}
                  now={now}
                  href={detailHref(budget)}
                />
              </div>
            ))}
          </div>
          {all.length > 0 && (
            <p className="text-center text-xs text-text-3">{t("budgets.list.footnote")}</p>
          )}
        </>
      )}
    </div>
  );
}
