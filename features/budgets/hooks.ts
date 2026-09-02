"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBudget, fetchBudgets } from "./api";
import { budgetKeys } from "./keys";

export function useBudgetsQuery(reference?: string) {
  return useQuery({
    queryKey: budgetKeys.list(reference),
    queryFn: () => fetchBudgets({ reference }),
    select: (list) => list.data,
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
