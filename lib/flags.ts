import { env } from "@/lib/env";

export type FeatureFlag =
  | "exportTransactions"
  | "importTransactions"
  | "forgotPassword"
  | "emailVerification"
  | "offlineSync"
  | "componentCatalog";

type Flags = Readonly<Record<FeatureFlag, boolean>>;

const base: Flags = {
  exportTransactions: false,
  importTransactions: false,
  forgotPassword: false,
  emailVerification: false,
  offlineSync: false,
  componentCatalog: true,
};

const flagsByEnvironment: Readonly<Record<typeof env.NODE_ENV, Flags>> = {
  development: base,
  test: base,
  production: { ...base, componentCatalog: false },
};

export const flags: Flags = flagsByEnvironment[env.NODE_ENV];

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag];
}
