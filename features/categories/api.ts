import { api } from "@/lib/api/client";
import {
  type CategoryListParams,
  readCategories,
  readCategory,
  readSpending,
} from "@/lib/local/repository";
import type {
  Category,
  CreateCategoryInput,
  RestoreDefaultsResponse,
  RestoreInput,
  StatsResponse,
  UpdateCategoryInput,
} from "@/types/api";

export type CategoryType = NonNullable<Category["type"]>;
export type SpendingType = Extract<CategoryType, "EXPENSE" | "INCOME">;

export type CategoryFilters = CategoryListParams;

// Reads go through the repository, which falls back to the offline mirror; writes are still the
// plain API call until the outbox lands (O-F4).
export function fetchCategories(filters: CategoryFilters = {}): Promise<Category[]> {
  return readCategories(filters);
}

export function fetchCategory(id: string): Promise<Category> {
  return readCategory(id);
}

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  return api<Category>("/categories", { method: "POST", body: input });
}

export function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  return api<Category>(`/categories/${id}`, { method: "PUT", body: input });
}

export function archiveCategory(id: string): Promise<unknown> {
  return api<unknown>(`/categories/${id}`, { method: "DELETE" });
}

export function restoreCategory(id: string, input: RestoreInput = {}): Promise<Category> {
  return api<Category>(`/categories/${id}/restore`, { method: "POST", body: input });
}

export function restoreDefaultCategories(): Promise<RestoreDefaultsResponse> {
  return api<RestoreDefaultsResponse>("/categories/restore-defaults", { method: "POST" });
}

export interface CategoryUsageParams {
  type: SpendingType;
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
