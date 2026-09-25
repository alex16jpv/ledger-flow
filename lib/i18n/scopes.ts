export const MESSAGE_SCOPES = {
  root: ["public.error"],
  auth: ["auth", "common", "errors", "settings", "validation"],
  onboarding: [
    "accountTypeDescriptions",
    "accountTypes",
    "accounts",
    "auth",
    "budgets",
    "colors",
    "common",
    "errors",
    "onboarding",
    "settings",
    "states",
    "validation",
  ],
  app: [
    "accountTypeDescriptions",
    "accountTypes",
    "accounts",
    "auth",
    "budgets",
    "categories",
    "categoryTypes",
    "charts",
    "colors",
    "common",
    "dev",
    "errors",
    "home",
    "nav",
    "onboarding",
    "settings",
    "shared",
    "states",
    "stats",
    "transactionTypes",
    "transactions",
    "trends",
    "validation",
  ],
  dev: [
    "accountTypes",
    "accounts",
    "charts",
    "colors",
    "common",
    "dev",
    "errors",
    "settings",
    "states",
  ],
} as const satisfies Record<string, readonly string[]>;

export type MessageScope = keyof typeof MESSAGE_SCOPES;

interface MessageTree {
  [key: string]: string | MessageTree;
}

export function pickMessages(messages: MessageTree, paths: readonly string[]): MessageTree {
  const picked: MessageTree = {};
  for (const path of paths) {
    const outer = paths.find((other) => path.startsWith(`${other}.`));
    if (outer) throw new Error(`pickMessages: "${path}" is already inside "${outer}"`);
    const parts = path.split(".");
    const leaf = parts.pop() ?? path;
    let from: string | MessageTree | undefined = messages;
    let into = picked;
    for (const part of parts) {
      from = typeof from === "object" ? from[part] : undefined;
      const next = into[part];
      into = typeof next === "object" ? next : (into[part] = {});
    }
    const value = typeof from === "object" ? from[leaf] : undefined;
    if (value === undefined) throw new Error(`pickMessages: no messages at "${path}"`);
    into[leaf] = value;
  }
  return picked;
}
