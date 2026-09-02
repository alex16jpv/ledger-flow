"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { monthWindow, shiftMonth, toIsoWindow } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { UpdateBudgetInput } from "@/types/api";

import {
  archiveBudget,
  type BudgetFilters,
  createBudget,
  fetchBudget,
  fetchBudgets,
  fetchSpendingTotal,
  removeBudgetOverride,
  setBudgetOverride,
  updateBudget,
} from "./api";
import { budgetKeys } from "./keys";

export function useBudgetsQuery(filters: BudgetFilters = {}, enabled = true) {
  return useQuery({
    queryKey: budgetKeys.list(filters),
    queryFn: () => fetchBudgets(filters),
    enabled,
  });
}

export function useBudgetQuery(id: string, reference?: string) {
  return useQuery({
    queryKey: budgetKeys.detail(id, reference),
    queryFn: () => fetchBudget(id, reference),
  });
}

function useBudgetInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
      queryClient.invalidateQueries({ queryKey: QUERY_DOMAINS.home }),
    ]);
  };
}

export function useCreateBudget() {
  const invalidate = useBudgetInvalidation();
  return useMutation({ mutationFn: createBudget, onSuccess: invalidate });
}

export function useUpdateBudget(id: string) {
  const invalidate = useBudgetInvalidation();
  return useMutation({
    mutationFn: (input: UpdateBudgetInput) => updateBudget(id, input),
    onSuccess: invalidate,
  });
}

export function useArchiveBudget() {
  const invalidate = useBudgetInvalidation();
  return useMutation({ mutationFn: archiveBudget, onSuccess: invalidate });
}

export function useSetBudgetOverride(id: string) {
  const invalidate = useBudgetInvalidation();
  return useMutation({
    mutationFn: ({ reference, amount }: { reference: string; amount: number }) =>
      setBudgetOverride(id, reference, amount),
    onSuccess: invalidate,
  });
}

export function useRemoveBudgetOverride(id: string) {
  const invalidate = useBudgetInvalidation();
  return useMutation({
    mutationFn: ({ reference }: { reference: string }) => removeBudgetOverride(id, reference),
    onSuccess: invalidate,
  });
}

// Owner request F-01: budget suggestions follow what the user actually spent last month.
export function useLastMonthSpending() {
  const { timeZone } = useFormatSettings();
  const window = useMemo(
    () => toIsoWindow(monthWindow(shiftMonth(new Date(), -1, timeZone), timeZone)),
    [timeZone],
  );
  return useQuery({
    queryKey: budgetKeys.lastMonthSpending(window.from),
    queryFn: () => fetchSpendingTotal(window.from, window.to),
    select: (stats) => stats.total,
    staleTime: 5 * 60 * 1000,
  });
}
