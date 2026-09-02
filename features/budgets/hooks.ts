"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type BudgetFilters, createBudget, fetchBudgets } from "./api";
import { budgetKeys } from "./keys";

export function useBudgetsQuery(filters: BudgetFilters = {}, enabled = true) {
  return useQuery({
    queryKey: budgetKeys.list(filters),
    queryFn: () => fetchBudgets(filters),
    enabled,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBudget,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
