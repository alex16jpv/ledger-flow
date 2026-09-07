"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { dayKey, toIsoWindow } from "@/lib/format/dates";
import { useDates } from "@/lib/i18n/useDates";
import type { Budget, StatsBucket } from "@/types/api";

import {
  fetchHomeAccounts,
  fetchHomeBudgets,
  fetchHomeCategories,
  fetchHomePending,
  fetchSpending,
} from "./api";
import { homeKeys } from "./keys";

export interface MonthContext {
  from: string;
  to: string;
  reference: Date;
  dayOfMonth: number;
  daysInMonth: number;
  yesterdayKey: string | null;
}

export function useMonthContext(now = new Date()): MonthContext {
  const dates = useDates();
  return useMemo(() => {
    const window = dates.monthWindow(now);
    const { from, to } = toIsoWindow(window);
    const dayOfMonth = Number(dates.dayKey(now).slice(-2));
    const daysInMonth = Math.round((window.to.getTime() - window.from.getTime()) / 86_400_000);
    const yesterday = new Date(now.getTime() - 86_400_000);
    const yesterdayKey = yesterday >= window.from ? dayKey(yesterday, dates.timeZone) : null;
    return { from, to, reference: now, dayOfMonth, daysInMonth, yesterdayKey };
  }, [dates, now]);
}

export function isGlobalMonthlyBudget(budget: Budget): boolean {
  return (
    budget.categoryIds.length === 0 &&
    budget.periodType === "MONTHLY" &&
    budget.type === "EXPENSE" &&
    !budget.archivedAt
  );
}

export interface DayBar {
  value: number;
  label: string;
  today?: boolean;
}

// The API returns only the days with spending; the chart shows every day of the month with gaps at 0.
export function dayBars(
  buckets: readonly StatsBucket[],
  month: Pick<MonthContext, "from" | "daysInMonth" | "dayOfMonth">,
  timeZone: string,
): DayBar[] {
  const byDay = new Map(buckets.map((bucket) => [bucket.key, bucket.total]));
  const prefix = dayKey(new Date(month.from), timeZone).slice(0, 8);
  return Array.from({ length: month.daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = `${prefix}${String(day).padStart(2, "0")}`;
    return { value: byDay.get(key) ?? 0, label: key, today: day === month.dayOfMonth };
  });
}

export const TOP_BUDGETS = 3;

// The global monthly budget already lives in the hero; the list ranks the rest by share consumed.
export function topBudgets(budgets: readonly Budget[], limit = TOP_BUDGETS): Budget[] {
  return budgets
    .filter((budget) => !budget.archivedAt && !budget.expired && !isGlobalMonthlyBudget(budget))
    .filter((budget) => budget.amount > 0)
    .sort((a, b) => b.spent / b.amount - a.spent / a.amount)
    .slice(0, limit);
}

export type BudgetStatus =
  | { kind: "over"; by: number }
  | { kind: "warn"; percent: number; daysLeft: number }
  | { kind: "ok"; left: number };

export function budgetStatus(
  budget: Pick<Budget, "spent" | "amount" | "periodTo">,
  now: Date,
): BudgetStatus {
  const ratio = budget.spent / budget.amount;
  if (ratio > 1) return { kind: "over", by: budget.spent - budget.amount };
  if (ratio >= 0.8) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(budget.periodTo).getTime() - now.getTime()) / 86_400_000),
    );
    return { kind: "warn", percent: Math.round(ratio * 100), daysLeft };
  }
  return { kind: "ok", left: budget.amount - budget.spent };
}

export function useHomeData(month: MonthContext) {
  const spending = useQuery({
    queryKey: homeKeys.spending(month.from, month.to, "EXPENSE", "day"),
    queryFn: () =>
      fetchSpending({ from: month.from, to: month.to, type: "EXPENSE", groupBy: "day" }),
  });
  const income = useQuery({
    queryKey: homeKeys.spending(month.from, month.to, "INCOME"),
    queryFn: () => fetchSpending({ from: month.from, to: month.to, type: "INCOME" }),
    select: (stats) => stats.total,
  });
  const accounts = useQuery({
    queryKey: homeKeys.accounts(),
    queryFn: fetchHomeAccounts,
    select: (list) => list.data.filter((account) => !account.archivedAt),
  });
  const budgets = useQuery({
    queryKey: homeKeys.budgets(month.from),
    queryFn: () => fetchHomeBudgets(month.reference.toISOString()),
    select: (list) => list.data,
  });

  const categories = useQuery({
    queryKey: homeKeys.categories(),
    queryFn: fetchHomeCategories,
    select: (list) => list.data,
    staleTime: 5 * 60 * 1000,
  });
  const pending = useQuery({
    queryKey: homeKeys.pending(),
    queryFn: fetchHomePending,
    select: (list) => ({ count: list.pagination.total, total: list.summary?.totalAmount ?? 0 }),
  });
  const globalBudget = budgets.data?.find(isGlobalMonthlyBudget) ?? null;
  const yesterdaySpent = month.yesterdayKey
    ? (spending.data?.buckets.find((bucket) => bucket.key === month.yesterdayKey)?.total ?? 0)
    : null;

  return {
    spending,
    income,
    accounts,
    budgets,
    categories,
    pending,
    globalBudget,
    yesterdaySpent,
    isLoading: spending.isPending || accounts.isPending || budgets.isPending,
    error: spending.error ?? accounts.error ?? budgets.error ?? income.error,
    refetch: () =>
      Promise.all([
        spending.refetch(),
        income.refetch(),
        accounts.refetch(),
        budgets.refetch(),
        categories.refetch(),
        pending.refetch(),
      ]),
  };
}
