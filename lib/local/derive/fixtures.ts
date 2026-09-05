import type { SyncTransaction } from "@/types/api";

import copBogota from "./fixtures/cop-bogota.json";
import eurMadrid from "./fixtures/eur-madrid.json";
import jpyTokyo from "./fixtures/jpy-tokyo.json";
import usdNewYork from "./fixtures/usd-new-york.json";

// The parity contract, vendored verbatim from the backend's committed `fixtures/offline/` with
// `npm run fixtures:sync`; CI only ever sees this copy, and `parity.test.ts` fails if the two drift.
// Only what O-F3 part 1 checks is typed here: `spending` and `budgets` arrive with part 2.

export interface FixtureAccount {
  key: string;
  id: string;
  openingBalance: number;
  archivedAt: string | null;
}

export interface FixtureTransaction {
  key: string;
  id: string;
  type: SyncTransaction["type"];
  amount: number;
  date: string;
  description: string | null;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  tags: string[];
  currency: string;
  source: SyncTransaction["source"];
  pendingDetails: boolean;
  deletedAt: string | null;
}

export interface ParityFixture {
  id: string;
  title: string;
  user: { id: string; timezone: string; currency: string; minorUnits: number };
  accounts: FixtureAccount[];
  transactions: FixtureTransaction[];
  expected: {
    balances: { key: string; accountId: string; balance: number }[];
    pending: { count: number; total: number; transactionIds: string[] };
  };
}

// A JSON import widens every enum to string, so the shape is asserted once here.
export const PARITY_FIXTURES = [copBogota, eurMadrid, jpyTokyo, usdNewYork] as unknown[] as [
  ParityFixture,
  ParityFixture,
  ParityFixture,
  ParityFixture,
];

export function parityFixture(id: string): ParityFixture {
  const fixture = PARITY_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`No parity fixture named ${id}`);
  return fixture;
}
