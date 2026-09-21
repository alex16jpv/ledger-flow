"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { dayKey, localNoon, toIsoWindow, trailingDaysWindow } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { REFERENCE_STALE_TIME_MS } from "@/lib/query/client";
import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { Category, RestoreInput, StatsBucket, UpdateCategoryInput } from "@/types/api";

import {
  archiveCategory,
  type CategoryType,
  createCategory,
  fetchCategories,
  fetchCategory,
  fetchCategoryCounts,
  fetchCategoryUsage,
  restoreCategory,
  restoreDefaultCategories,
  updateCategory,
} from "./api";
import { categoryKeys } from "./keys";
import { CATEGORY_TYPES } from "./schemas";

export const RECENT_DAYS = 90;
export const RECENT_LIMIT = 3;

export function useCategoriesQuery(type?: CategoryType, enabled = true, includeArchived = false) {
  return useQuery({
    queryKey: categoryKeys.list({ type, includeArchived }),
    queryFn: () => fetchCategories({ type, includeArchived }),
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled,
  });
}

export function useCategoryQuery(id: string) {
  return useQuery({ queryKey: categoryKeys.detail(id), queryFn: () => fetchCategory(id) });
}

function useCategoryInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
      queryClient.invalidateQueries({ queryKey: QUERY_DOMAINS.home }),
    ]);
  };
}

export function useCreateCategory() {
  const invalidate = useCategoryInvalidation();
  return useMutation({ mutationFn: createCategory, onSuccess: invalidate });
}

export function useUpdateCategory(id: string) {
  const invalidate = useCategoryInvalidation();
  return useMutation({
    mutationFn: (input: UpdateCategoryInput) => updateCategory(id, input),
    onSuccess: invalidate,
  });
}

export function useArchiveCategory() {
  const invalidate = useCategoryInvalidation();
  return useMutation({ mutationFn: archiveCategory, onSuccess: invalidate });
}

export interface RestoreVariables extends RestoreInput {
  id: string;
}

export function useRestoreCategory() {
  const invalidate = useCategoryInvalidation();
  return useMutation({
    mutationFn: ({ id, name }: RestoreVariables) => restoreCategory(id, name ? { name } : {}),
    onSuccess: invalidate,
  });
}

export function useRestoreDefaultCategories() {
  const invalidate = useCategoryInvalidation();
  return useMutation({ mutationFn: restoreDefaultCategories, onSuccess: invalidate });
}

// All-time transaction counts per category id, one stats call per type (transfers included).
export function useCategoryCounts(enabled = true) {
  return useQueries({
    queries: CATEGORY_TYPES.map((type) => ({
      queryKey: categoryKeys.counts(type),
      queryFn: () => fetchCategoryCounts(type),
      enabled,
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      counts: new Map(
        results.flatMap((result) =>
          (result.data?.buckets ?? []).map((bucket) => [bucket.key, bucket.count] as const),
        ),
      ),
    }),
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

export function useRecentCategories(
  type: CategoryType | undefined,
  categories: readonly Category[] | undefined,
  limit = RECENT_LIMIT,
  enabled = true,
): Category[] {
  const { timeZone } = useFormatSettings();
  const today = dayKey(new Date(), timeZone);
  const window = useMemo(
    () => toIsoWindow(trailingDaysWindow(localNoon(today, timeZone), RECENT_DAYS, timeZone)),
    [today, timeZone],
  );
  // T-86: /stats/spending groups transfers by category too, so all three types have recents.
  const statsType = type ?? null;
  const params = { type: statsType ?? "EXPENSE", ...window };
  const usage = useQuery({
    queryKey: categoryKeys.usage(params),
    queryFn: () => fetchCategoryUsage(params),
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled: enabled && statsType !== null,
  });
  const buckets = usage.data?.buckets;
  return useMemo(
    () =>
      statsType && buckets && categories ? rankRecentCategories(buckets, categories, limit) : [],
    [statsType, buckets, categories, limit],
  );
}
