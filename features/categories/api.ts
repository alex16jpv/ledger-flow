import { api } from "@/lib/api/client";
import type {
  Category,
  CategoryList,
  CreateCategoryInput,
  RestoreDefaultsResponse,
  RestoreInput,
  StatsResponse,
  UpdateCategoryInput,
} from "@/types/api";

export type CategoryType = NonNullable<Category["type"]>;
export type SpendingType = Extract<CategoryType, "EXPENSE" | "INCOME">;

export interface CategoryFilters {
  type?: CategoryType;
  includeArchived?: boolean;
}

export async function fetchCategories(filters: CategoryFilters = {}): Promise<Category[]> {
  const data: Category[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<CategoryList>("/categories", {
      query: {
        type: filters.type,
        includeArchived: filters.includeArchived ? "true" : undefined,
        limit: 100,
        cursor,
      },
    });
    data.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return data;
}

export function fetchCategory(id: string): Promise<Category> {
  return api<Category>(`/categories/${id}`);
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
  return api<StatsResponse>("/stats/spending", { query: { groupBy: "category", type, from, to } });
}

// No bounds: the whole history, which is what "n transactions" on a category tile means.
export function fetchCategoryCounts(type: CategoryType): Promise<StatsResponse> {
  return api<StatsResponse>("/stats/spending", { query: { groupBy: "category", type } });
}
