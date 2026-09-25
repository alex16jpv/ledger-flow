export const MESSAGE_SCOPES = {
  root: ["public.error"],
  auth: [
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

export interface MessageTree {
  [key: string]: string | MessageTree;
}

export function pickMessages(messages: MessageTree, paths: readonly string[]): MessageTree {
  const picked: MessageTree = {};
  paths: for (const path of paths) {
    const parts = path.split(".");
    let from: string | MessageTree | undefined = messages;
    let into = picked;
    for (const [index, part] of parts.entries()) {
      from = typeof from === "object" ? from[part] : undefined;
      if (from === undefined) throw new Error(`pickMessages: no messages at "${path}"`);
      if (index === parts.length - 1) {
        into[part] = from;
        continue paths;
      }
      const next = into[part];
      if (next === from) continue paths;
      into = typeof next === "object" ? next : (into[part] = {});
    }
  }
  return picked;
}
