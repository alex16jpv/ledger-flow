import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Category } from "@/types/Category.types";
import type {
  CreateCategoryFormFields,
  UpdateCategoryFormFields,
} from "@/lib/schemas/category.schema";
import {
  getCached,
  setCache,
  clearDomainCache,
  requestSignature,
  dedupedFetch,
  findInCachedCollections,
  findManyInCachedCollections,
} from "@/lib/cache";

const DOMAIN = "categories" as const;

export async function getCategories(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Category>>> {
  const sig = requestSignature("/api/categories", params);
  const cached = getCached<ProxyResponse<PaginatedResult<Category>>>(DOMAIN, sig);
  if (cached) return cached;

  return dedupedFetch(sig, async () => {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    const res = await fetch(`/api/categories${query}`);
    const data: ProxyResponse<PaginatedResult<Category>> = await res.json();
    if (!data.error) setCache(DOMAIN, sig, data);
    return data;
  });
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

  const sig = requestSignature("/api/categories", { ids: ids.join(",") });
  const cached = getCached<ProxyResponse<PaginatedResult<Category>>>(DOMAIN, sig);
  if (cached) return cached;

  const fromCollections = findManyInCachedCollections<Category>(DOMAIN, ids);
  if (fromCollections) {
    const result: ProxyResponse<PaginatedResult<Category>> = {
      data: {
        data: fromCollections,
        pagination: { limit: ids.length, offset: 0, total: fromCollections.length, hasMore: false, nextCursor: null },
      },
      status: 200,
      error: null,
    };
    setCache(DOMAIN, sig, result);
    return result;
  }

  return getCategories({ ids: ids.join(",") });
}

export async function getCategory(
  id: string,
): Promise<ProxyResponse<Category>> {
  const sig = requestSignature(`/api/categories/${id}`);
  const cached = getCached<ProxyResponse<Category>>(DOMAIN, sig);
  if (cached) return cached;

  const fromCollection = findInCachedCollections<Category>(DOMAIN, id);
  if (fromCollection) {
    const result: ProxyResponse<Category> = { data: fromCollection, status: 200, error: null };
    setCache(DOMAIN, sig, result);
    return result;
  }

  return dedupedFetch(sig, async () => {
    const res = await fetch(`/api/categories/${id}`);
    const data: ProxyResponse<Category> = await res.json();
    if (!data.error) setCache(DOMAIN, sig, data);
    return data;
  });
}

export async function createCategory(
  payload: CreateCategoryFormFields,
): Promise<ProxyResponse<Category>> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: ProxyResponse<Category> = await res.json();
  if (!data.error) clearDomainCache(DOMAIN);
  return data;
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
  const data: ProxyResponse<Category> = await res.json();
  if (!data.error) clearDomainCache(DOMAIN);
  return data;
}

export async function deleteCategory(
  id: string,
): Promise<ProxyResponse<null>> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "DELETE",
  });
  const data: ProxyResponse<null> = await res.json();
  if (!data.error) clearDomainCache(DOMAIN);
  return data;
}
