export const authKeys = {
  all: ["auth"] as const,
  pendingSignUp: () => [...authKeys.all, "pending-sign-up"] as const,
};
