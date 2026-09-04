import { api } from "@/lib/api/client";
import type { Category, CategoryList } from "@/types/api";

import { read } from "./read";

export const CATEGORY_PAGE_LIMIT = 100;

export interface CategoryListParams {
  type?: NonNullable<Category["type"]>;
  includeArchived?: boolean;
}

async function drain(params: CategoryListParams): Promise<Category[]> {
  const data: Category[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<CategoryList>("/categories", {
      query: {
        type: params.type,
        includeArchived: params.includeArchived ? "true" : undefined,
        limit: CATEGORY_PAGE_LIMIT,
        cursor,
      },
    });
    data.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return data;
}

export function readCategories(params: CategoryListParams = {}): Promise<Category[]> {
  return read<Category[]>(
    () => drain(params),
    async (db) => {
      const records = await db.getAll("categories");
      return records
        .filter(
          (record) =>
            (params.includeArchived === true || record.archived === 0) &&
            (params.type === undefined || record.row.type === params.type),
        )
        .map((record) => record.row);
    },
  );
}

export function readCategory(id: string): Promise<Category> {
  return read<Category>(
    () => api<Category>(`/categories/${id}`),
    async (db) => (await db.get("categories", id))?.row,
  );
}
