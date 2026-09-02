"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { dayKey, toIsoWindow, trailingDaysWindow } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import type { Category, StatsBucket } from "@/types/api";

import {
  type CategoryType,
  createCategory,
  fetchCategories,
  fetchCategoryUsage,
  type SpendingType,
} from "./api";
import { categoryKeys } from "./keys";

export const RECENT_DAYS = 90;
export const RECENT_LIMIT = 3;

export function useCategoriesQuery(type?: CategoryType) {
  return useQuery({
    queryKey: categoryKeys.list({ type }),
    queryFn: () => fetchCategories({ type }),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function rankRecentCategories(
  buckets: readonly StatsBucket[],
  categories: readonly Category[],
  limit = RECENT_LIMIT,
): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return [...buckets]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .flatMap((bucket) => byId.get(bucket.key) ?? [])
    .slice(0, limit);
}

function spendingType(type: CategoryType | undefined): SpendingType | null {
  return type === "EXPENSE" || type === "INCOME" ? type : null;
}

export function useRecentCategories(
  type: CategoryType | undefined,
  categories: readonly Category[] | undefined,
): Category[] {
  const { timeZone } = useFormatSettings();
  const today = dayKey(new Date(), timeZone);
  const window = useMemo(
    () => toIsoWindow(trailingDaysWindow(new Date(`${today}T12:00:00Z`), RECENT_DAYS, timeZone)),
    [today, timeZone],
  );
  const statsType = spendingType(type);
  const params = { type: statsType ?? "EXPENSE", ...window };
  const usage = useQuery({
    queryKey: categoryKeys.usage(params),
    queryFn: () => fetchCategoryUsage(params),
    enabled: statsType !== null,
  });
  const buckets = usage.data?.buckets;
  return useMemo(
    () => (statsType && buckets && categories ? rankRecentCategories(buckets, categories) : []),
    [statsType, buckets, categories],
  );
}
