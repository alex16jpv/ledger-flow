export const accountKeys = {
  all: ["accounts"] as const,
  list: (includeArchived = false) => [...accountKeys.all, "list", { includeArchived }] as const,
  detail: (id: string) => [...accountKeys.all, "detail", id] as const,
};
