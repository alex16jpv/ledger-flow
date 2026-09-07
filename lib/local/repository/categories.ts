import { api } from "@/lib/api/client";
import type { Category, CategoryList } from "@/types/api";

import type { CategoryRecord } from "../schema";
import { mirrorPage, read } from "./read";

export const CATEGORY_PAGE_LIMIT = 100;

export interface CategoryListParams {
  type?: NonNullable<Category["type"]>;
  includeArchived?: boolean;
  limit?: number;
}

function listQuery(params: CategoryListParams, cursor?: string) {
  return {
    type: params.type,
    includeArchived: params.includeArchived ? "true" : undefined,
    limit: params.limit ?? CATEGORY_PAGE_LIMIT,
    cursor,
  };
}

async function drain(params: CategoryListParams): Promise<Category[]> {
  const data: Category[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<CategoryList>("/categories", { query: listQuery(params, cursor) });
    data.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return data;
}

function matching(records: CategoryRecord[], params: CategoryListParams): Category[] {
  return records
    .filter(
      (record) =>
        (params.includeArchived === true || record.archived === 0) &&
        (params.type === undefined || record.row.type === params.type),
    )
    .map((record) => record.row);
}

export function readCategories(params: CategoryListParams = {}): Promise<Category[]> {
  return read<Category[]>(
    () => drain(params),
    async (db) => matching(await db.getAll("categories"), params),
  );
}

export function readCategoriesPage(params: CategoryListParams = {}): Promise<CategoryList> {
  const limit = params.limit ?? CATEGORY_PAGE_LIMIT;
  return read<CategoryList>(
    () => api<CategoryList>("/categories", { query: listQuery(params) }),
    async (db) => mirrorPage(matching(await db.getAll("categories"), params), limit),
  );
}

export function readCategory(id: string): Promise<Category> {
  return read<Category>(
    () => api<Category>(`/categories/${id}`),
    async (db) => (await db.get("categories", id))?.row,
  );
}
