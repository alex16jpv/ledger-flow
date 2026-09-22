import { QUERY_DOMAINS } from "@/lib/query/domains";

export const contactKeys = {
  all: QUERY_DOMAINS.contacts,
  list: (includeArchived = false) => [...contactKeys.all, "list", { includeArchived }] as const,
  page: () => [...contactKeys.all, "page"] as const,
  detail: (id: string) => [...contactKeys.all, "detail", id] as const,
};

export const sharedKeys = {
  all: QUERY_DOMAINS.shared,
  ledger: () => [...sharedKeys.all, "ledger"] as const,
  received: () => [...sharedKeys.all, "invitations", "received"] as const,
  sent: (groupId: string) => [...sharedKeys.all, "invitations", "sent", groupId] as const,
};
