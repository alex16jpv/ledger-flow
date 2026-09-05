import type { StatsResponse, SyncBudget, SyncTransaction } from "@/types/api";

import copBogota from "./fixtures/cop-bogota.json";
import eurMadrid from "./fixtures/eur-madrid.json";
import jpyTokyo from "./fixtures/jpy-tokyo.json";
import usdNewYork from "./fixtures/usd-new-york.json";

// The parity contract, vendored verbatim from the backend's committed `fixtures/offline/` with
// `npm run fixtures:sync`; CI only ever sees this copy, and `parity.test.ts` fails if the two drift.
// The shapes are `Fixture*` from the backend's `scripts/offline-fixtures/types.ts`, kept in its
// vocabulary rather than restated: a field that changes name there has to change name here too.

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

export interface FixtureCategory {
  key: string;
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME";
  archivedAt: string | null;
}

// As STORED, which is the shape GET /sync/changes sends: no periodKey, spent or expired.
export interface FixtureBudget {
  key: string;
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME";
  categoryIds: string[];
  amount: number;
  amountOverrides: Record<string, number>;
  currency: string;
  periodType: SyncBudget["periodType"];
  periodStartDate: string | null;
  periodEndDate: string | null;
  effectiveFrom: string | null;
  archivedAt: string | null;
}

// Every query is spelled out, so a test reads the question from the fixture instead of inventing it.
export interface ExpectedSpending {
  name: string;
  query: {
    groupBy: StatsResponse["groupBy"];
    type: SyncTransaction["type"] | null;
    from: string;
    to: string;
    timezone: string;
  };
  total: number;
  buckets: { key: string; total: number; count: number; avg: number }[];
}

export interface ExpectedBudgetView {
  key: string;
  id: string;
  periodKey: string;
  periodFrom: string;
  periodTo: string;
  baseAmount: number;
  amount: number;
  hasOverride: boolean;
  spent: number;
  expired: boolean;
  archivedCategoryIds: string[];
}

export interface ParityFixture {
  id: string;
  title: string;
  user: { id: string; timezone: string; currency: string; minorUnits: number };
  accounts: FixtureAccount[];
  categories: FixtureCategory[];
  transactions: FixtureTransaction[];
  budgets: FixtureBudget[];
  expected: {
    balances: { key: string; accountId: string; balance: number }[];
    pending: { count: number; total: number; transactionIds: string[] };
    spending: ExpectedSpending[];
    budgets: { reference: string; views: ExpectedBudgetView[] };
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
