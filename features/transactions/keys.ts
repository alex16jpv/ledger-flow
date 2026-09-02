export const transactionKeys = {
  all: ["transactions"] as const,
  pendingCount: () => [...transactionKeys.all, "pending-count"] as const,
};
