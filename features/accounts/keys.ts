import { QUERY_DOMAINS } from "@/lib/query/domains";

export const accountKeys = {
  all: QUERY_DOMAINS.accounts,
  list: (includeArchived = false) => [...accountKeys.all, "list", { includeArchived }] as const,
  detail: (id: string) => [...accountKeys.all, "detail", id] as const,
};
