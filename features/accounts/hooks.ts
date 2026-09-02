"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createAccount, fetchAccounts } from "./api";
import { accountKeys } from "./keys";

export function useAccountsQuery(includeArchived = false) {
  return useQuery({
    queryKey: accountKeys.list(includeArchived),
    queryFn: () => fetchAccounts({ includeArchived }),
    select: (list) => list.data,
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
