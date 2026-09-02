"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { UpdateAccountInput } from "@/types/api";

import {
  archiveAccount,
  createAccount,
  fetchAccount,
  fetchAccounts,
  restoreAccount,
  setDefaultAccount,
  updateAccount,
} from "./api";
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

export function useAccountQuery(id: string) {
  return useQuery({ queryKey: accountKeys.detail(id), queryFn: () => fetchAccount(id) });
}

function useAccountInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
      queryClient.invalidateQueries({ queryKey: QUERY_DOMAINS.home }),
    ]);
  };
}

export function useCreateAccount() {
  const invalidate = useAccountInvalidation();
  return useMutation({ mutationFn: createAccount, onSuccess: invalidate });
}

export function useUpdateAccount(id: string) {
  const invalidate = useAccountInvalidation();
  return useMutation({
    mutationFn: (input: UpdateAccountInput) => updateAccount(id, input),
    onSuccess: invalidate,
  });
}

export function useArchiveAccount() {
  const invalidate = useAccountInvalidation();
  return useMutation({ mutationFn: archiveAccount, onSuccess: invalidate });
}

export function useRestoreAccount() {
  const invalidate = useAccountInvalidation();
  return useMutation({ mutationFn: restoreAccount, onSuccess: invalidate });
}

export function useSetDefaultAccount() {
  const invalidate = useAccountInvalidation();
  return useMutation({ mutationFn: setDefaultAccount, onSuccess: invalidate });
}
