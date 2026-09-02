"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { UpdateBudgetInput } from "@/types/api";

import {
  archiveBudget,
  type BudgetFilters,
  createBudget,
  fetchBudget,
  fetchBudgets,
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
