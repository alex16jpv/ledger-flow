export const budgetKeys = {
  all: ["budgets"] as const,
  list: (reference?: string) =>
    [...budgetKeys.all, "list", { reference: reference ?? null }] as const,
  detail: (id: string, reference?: string) =>
    [...budgetKeys.all, "detail", id, { reference: reference ?? null }] as const,
};
