import { QUERY_DOMAINS } from "@/lib/query/domains";

import type { CategoryFilters, CategoryUsageParams } from "./api";

export const categoryKeys = {
  all: QUERY_DOMAINS.categories,
  list: (filters: CategoryFilters = {}) => [...categoryKeys.all, "list", filters] as const,
  usage: (params: CategoryUsageParams) => [...categoryKeys.all, "usage", params] as const,
};
