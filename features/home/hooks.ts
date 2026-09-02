"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { dayKey, toIsoWindow } from "@/lib/format/dates";
import { useDates } from "@/lib/i18n/useDates";
import type { Budget } from "@/types/api";

import { fetchHomeAccounts, fetchHomeBudgets, fetchSpending } from "./api";
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

  const globalBudget = budgets.data?.find(isGlobalMonthlyBudget) ?? null;
  const yesterdaySpent = month.yesterdayKey
    ? (spending.data?.buckets.find((bucket) => bucket.key === month.yesterdayKey)?.total ?? 0)
    : null;

  return {
    spending,
    income,
    accounts,
    budgets,
    globalBudget,
    yesterdaySpent,
    isLoading: spending.isPending || accounts.isPending || budgets.isPending,
    error: spending.error ?? accounts.error ?? budgets.error ?? income.error,
    refetch: () =>
      Promise.all([spending.refetch(), income.refetch(), accounts.refetch(), budgets.refetch()]),
  };
}
