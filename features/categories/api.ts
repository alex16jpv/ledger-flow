import { api } from "@/lib/api/client";
import { pullAfterDirectSend } from "@/lib/local/outbox";
import {
  type CategoryListParams,
  readCategories,
  readCategory,
  readSpending,
} from "@/lib/local/repository";
import type { Category, RestoreDefaultsResponse, StatsResponse } from "@/types/api";

export type CategoryType = NonNullable<Category["type"]>;

export type CategoryFilters = CategoryListParams;

// O-F4: reads via the repository, writes via the outbox; `restore-defaults` stays a plain call.
export {
  archiveCategory,
  createCategory,
  restoreCategory,
  updateCategory,
} from "@/lib/local/outbox";

export function fetchCategories(filters: CategoryFilters = {}): Promise<Category[]> {
  return readCategories(filters);
}

export function fetchCategory(id: string): Promise<Category> {
  return readCategory(id);
}

export async function restoreDefaultCategories(): Promise<RestoreDefaultsResponse> {
  const answer = await api<RestoreDefaultsResponse>("/categories/restore-defaults", {
    method: "POST",
  });
  // The rows the server just minted are not in the mirror, and the mirror is what the list reads.
  await pullAfterDirectSend();
  return answer;
}

export interface CategoryUsageParams {
  type: CategoryType;
  from: string;
  to: string;
}

export function fetchCategoryUsage({
  type,
  from,
  to,
}: CategoryUsageParams): Promise<StatsResponse> {
  return readSpending({ groupBy: "category", type, from, to });
}

// No bounds: the whole history, which is what "n transactions" on a category tile means.
export function fetchCategoryCounts(type: CategoryType): Promise<StatsResponse> {
  return readSpending({ groupBy: "category", type });
}
