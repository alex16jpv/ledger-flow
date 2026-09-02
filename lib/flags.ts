import { env } from "@/lib/env";

export type FeatureFlag =
  | "exportTransactions"
  | "importTransactions"
  | "forgotPassword"
  | "emailVerification"
  | "offlineSync"
  | "componentCatalog"
  | "devLogin";

type Flags = Readonly<Record<FeatureFlag, boolean>>;

const base: Flags = {
  exportTransactions: false,
  importTransactions: false,
  forgotPassword: false,
  emailVerification: false,
  offlineSync: false,
  componentCatalog: true,
  devLogin: false,
};

export type AppEnvironment = typeof env.NODE_ENV;

const flagsByEnvironment: Readonly<Record<AppEnvironment, Flags>> = {
  development: { ...base, devLogin: true },
  test: base,
  production: { ...base, componentCatalog: false },
};

// The e2e suite runs a production build: NEXT_PUBLIC_APP_ENV=test keeps the dev-only screens reachable there.
export const appEnvironment: AppEnvironment = env.NEXT_PUBLIC_APP_ENV ?? env.NODE_ENV;

export const flags: Flags = flagsByEnvironment[appEnvironment];

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag];
}
