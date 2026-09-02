import type { CategoryFilters, CategoryUsageParams } from "./api";

export const categoryKeys = {
  all: ["categories"] as const,
  list: (filters: CategoryFilters = {}) => [...categoryKeys.all, "list", filters] as const,
  usage: (params: CategoryUsageParams) => [...categoryKeys.all, "usage", params] as const,
};
