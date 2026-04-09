import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Category } from "@/types/Category.types";
import type {
  CreateCategoryFormFields,
  UpdateCategoryFormFields,
} from "@/lib/schemas/category.schema";
import { getCached, setCache, invalidateDomain, requestSignature } from "@/lib/cache";
import { safeFetch } from "@/lib/api/safeFetch";

const DOMAIN = "categories" as const;

export async function getCategories(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Category>>> {
  const sig = requestSignature("/api/categories", params);
  const cached = getCached<ProxyResponse<PaginatedResult<Category>>>(DOMAIN, sig);
  if (cached) return cached;

  const query = params ? `?${new URLSearchParams(params)}` : "";
  const data = await safeFetch<PaginatedResult<Category>>(`/api/categories${query}`);
  if (!data.error) setCache(DOMAIN, sig, data);
  return data;
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
  const sig = requestSignature(`/api/categories/${id}`);
  const cached = getCached<ProxyResponse<Category>>(DOMAIN, sig);
  if (cached) return cached;

  const res = await safeFetch<Category>(`/api/categories/${id}`);
  if (!res.error) setCache(DOMAIN, sig, res);
  return res;
}

export async function createCategory(
  payload: CreateCategoryFormFields,
): Promise<ProxyResponse<Category>> {
  const data = await safeFetch<Category>("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryFormFields,
): Promise<ProxyResponse<Category>> {
  const data = await safeFetch<Category>(`/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}

export async function deleteCategory(
  id: string,
): Promise<ProxyResponse<null>> {
  const data = await safeFetch<null>(`/api/categories/${id}`, {
    method: "DELETE",
  });
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}
