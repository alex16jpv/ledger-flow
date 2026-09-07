export const settingsKeys = {
  all: ["settings"] as const,
  categorySummary: () => [...settingsKeys.all, "category-summary"] as const,
  accountCount: () => [...settingsKeys.all, "account-count"] as const,
  sessions: () => [...settingsKeys.all, "sessions"] as const,
};
