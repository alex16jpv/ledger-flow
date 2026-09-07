"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refreshSession } from "@/lib/api/refresh";
import { type AppLocale } from "@/lib/i18n/routing";
import { tabChannel } from "@/lib/session/channel";
import { useSession } from "@/lib/session/SessionProvider";
import type { UpdateUserInput } from "@/types/api";

import {
  deleteUser,
  fetchAccountCount,
  fetchCategorySummary,
  fetchSessions,
  reauthenticate,
  revokeSession,
  updateUser,
} from "./api";
import { settingsKeys } from "./keys";

export function useCategorySummary(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.categorySummary(),
    queryFn: fetchCategorySummary,
    enabled,
    select: (list) => ({
      active: list.data.filter((category) => !category.archivedAt).length,
      archived: list.data.filter((category) => Boolean(category.archivedAt)).length,
    }),
  });
}

export function useSessionsQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.sessions(),
    queryFn: fetchSessions,
    enabled,
    select: (result) => [...result.data].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt)),
  });
}

export function useSessionCount(enabled = true) {
  return useSessionsQuery(enabled).data?.length;
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.sessions() }),
  });
}

export function useHasAccounts(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.accountCount(),
    queryFn: fetchAccountCount,
    enabled,
    select: (list) => list.pagination.total > 0,
  });
}

export interface ProfileChange extends UpdateUserInput {
  reauthenticateWith?: { email: string; password: string };
}

// Email or password changes revoke every refresh token, so this device signs in again with the new pair.
export function useUpdateProfile() {
  const { user, setUser } = useSession();
  return useMutation({
    mutationFn: async ({ reauthenticateWith, ...input }: ProfileChange) => {
      if (!user) throw new Error("No session");
      const updated = await updateUser(user.id, input);
      if (reauthenticateWith)
        await reauthenticate(reauthenticateWith.email, reauthenticateWith.password);
      return updated;
    },
    onSuccess: (updated) => {
      setUser(updated);
    },
  });
}

// Budgets and stats resolve periods with the zone in the access token: refresh it right away.
export function useUpdateTimeZone() {
  const { user, setUser } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (timezone: string) => {
      if (!user) throw new Error("No session");
      const updated = await updateUser(user.id, { timezone });
      await refreshSession();
      return updated;
    },
    onSuccess: async (updated) => {
      setUser(updated);
      await queryClient.invalidateQueries();
    },
  });
}

export function useUpdateCurrency() {
  const { user, setUser } = useSession();
  return useMutation({
    mutationFn: async (currency: string) => {
      if (!user) throw new Error("No session");
      return updateUser(user.id, { currency });
    },
    onSuccess: (updated) => {
      setUser(updated);
    },
  });
}

export function useDeleteAccount() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No session");
      await deleteUser(user.id);
    },
  });
}

export function useUpdateLocale() {
  const { user, setUser } = useSession();
  return useMutation({
    mutationFn: async (locale: AppLocale) => {
      if (!user) throw new Error("No session");
      return updateUser(user.id, { locale });
    },
    onSuccess: (updated) => {
      setUser(updated);
      tabChannel.post({ type: "locale", locale: updated.locale });
    },
  });
}
