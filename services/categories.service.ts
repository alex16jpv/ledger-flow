import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Category } from "@/types/Category.types";
import type {
  CreateCategoryFormFields,
  UpdateCategoryFormFields,
} from "@/lib/schemas/category.schema";

export async function getCategories(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Category>>> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`/api/categories${query}`);
  return res.json();
}

export async function getCategoriesByIds(
  ids: string[],
): Promise<ProxyResponse<PaginatedResult<Category>>> {
  if (ids.length === 0) {
    return {
      data: { data: [], pagination: { limit: 0, offset: 0, total: 0, hasMore: false, nextCursor: null } },
      status: 200,
      error: null,
    };
  }
  return getCategories({ ids: ids.join(",") });
}

export async function getCategory(
  id: string,
): Promise<ProxyResponse<Category>> {
  const res = await fetch(`/api/categories/${id}`);
  return res.json();
}

export async function createCategory(
  payload: CreateCategoryFormFields,
): Promise<ProxyResponse<Category>> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryFormFields,
): Promise<ProxyResponse<Category>> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteCategory(
  id: string,
): Promise<ProxyResponse<null>> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "DELETE",
  });
  return res.json();
}
