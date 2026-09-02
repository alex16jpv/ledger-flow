export const homeKeys = {
  all: ["home"] as const,
  spending: (from: string, to: string, type: string, groupBy?: string) =>
    [...homeKeys.all, "spending", { from, to, type, groupBy: groupBy ?? null }] as const,
  accounts: () => [...homeKeys.all, "accounts"] as const,
  budgets: (reference: string) => [...homeKeys.all, "budgets", { reference }] as const,
};
