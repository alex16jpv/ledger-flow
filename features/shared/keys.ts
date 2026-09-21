import { QUERY_DOMAINS } from "@/lib/query/domains";

export const contactKeys = {
  all: QUERY_DOMAINS.contacts,
  list: (includeArchived = false) => [...contactKeys.all, "list", { includeArchived }] as const,
  page: (cursor?: string) => [...contactKeys.all, "page", { cursor: cursor ?? null }] as const,
  detail: (id: string) => [...contactKeys.all, "detail", id] as const,
};

// One key for the whole section: a payment is imputed across every group, so the rows read together.
export const sharedKeys = {
  all: QUERY_DOMAINS.shared,
  ledger: () => [...sharedKeys.all, "ledger"] as const,
};
