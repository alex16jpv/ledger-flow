"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { type AppLocale } from "@/lib/i18n/routing";
import { tabChannel } from "@/lib/session/channel";
import { useSession } from "@/lib/session/SessionProvider";

import { fetchCategorySummary, fetchSessions, updateUser } from "./api";
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

export function useSessionCount(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.sessions(),
    queryFn: fetchSessions,
    enabled,
    select: (result) => result.data.length,
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
