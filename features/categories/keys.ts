import { QUERY_DOMAINS } from "@/lib/query/domains";

import type { CategoryFilters, CategoryType, CategoryUsageParams } from "./api";

export const categoryKeys = {
  all: QUERY_DOMAINS.categories,
  list: (filters: CategoryFilters = {}) => [...categoryKeys.all, "list", filters] as const,
  detail: (id: string) => [...categoryKeys.all, "detail", id] as const,
  usage: (params: CategoryUsageParams) => [...categoryKeys.all, "usage", params] as const,
  counts: (type: CategoryType) => [...categoryKeys.all, "counts", type] as const,
};
