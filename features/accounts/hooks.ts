"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createAccount, fetchAccounts } from "./api";
import { accountKeys } from "./keys";

// Reference data changes only through our own mutations, which invalidate it: a long staleTime saves round trips.
export const REFERENCE_STALE_TIME_MS = 5 * 60 * 1000;

export function useAccountsQuery(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: accountKeys.list(includeArchived),
    queryFn: () => fetchAccounts({ includeArchived }),
    select: (list) => list.data,
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
