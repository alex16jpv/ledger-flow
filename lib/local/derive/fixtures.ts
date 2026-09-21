import type {
  Category,
  SharedShare,
  SharedSplit,
  StatsResponse,
  StatsSplit,
  SyncBudget,
  SyncTransaction,
} from "@/types/api";

import copBogota from "./fixtures/cop-bogota.json";
import copShared from "./fixtures/cop-shared.json";
import eurMadrid from "./fixtures/eur-madrid.json";
import jpyTokyo from "./fixtures/jpy-tokyo.json";
import usdNewYork from "./fixtures/usd-new-york.json";

// Vendored verbatim from the backend with `npm run fixtures:sync`; `parity.test.ts` catches drift.

export interface FixtureAccount {
  key: string;
  id: string;
  name: string;
  type: string;
  currency: string;
  openingBalance: number;
  // The account every settle-up of a fixture names, which is what the seed does.
  isDefault: boolean;
  archivedAt: string | null;
}

export interface FixtureTransaction {
  key: string;
  id: string;
  type: SyncTransaction["type"];
  amount: number;
  date: string;
  dayKey: string;
  description: string | null;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  tags: string[];
  currency: string;
  source: SyncTransaction["source"];
  pendingDetails: boolean;
  // Absent means the whole amount is yours: the field arrived with splitting.
  countsAsYours?: number;
  deletedAt: string | null;
}

export interface FixtureCategory {
  key: string;
  id: string;
  name: string;
  type: NonNullable<Category["type"]>;
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
    splitBy: StatsResponse["splitBy"];
    categoryIds: string[] | null;
    type: SyncTransaction["type"] | null;
    from: string;
    to: string;
    timezone: string;
  };
  total: number;
  buckets: { key: string; total: number; count: number; avg: number; splits?: StatsSplit[] }[];
}

// A page the server can serve in one request, which is what the client is not allowed to walk to.
export interface ExpectedList {
  name: string;
  query: {
    sort: "date" | "amount";
    order: "asc" | "desc";
    categoryIds: string[] | null;
    type: SyncTransaction["type"] | null;
    from: string;
    to: string;
    timezone: string;
    limit: number;
  };
  transactionIds: string[];
  note?: string;
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

export interface FixtureContact {
  key: string;
  id: string;
  name: string;
  archivedAt: string | null;
}

// As STORED: the split is already resolved, and `collected` is the imputation of the live payments.
export interface FixtureSharedExpense {
  key: string;
  id: string;
  groupId: string;
  // The movement it is, when the user fronted it. The real link lives on the transaction.
  transactionId: string | null;
  description: string | null;
  date: string;
  amount: number;
  paidByContactId: string | null;
  customSplit: boolean;
  split: {
    mode: SharedSplit["mode"];
    guests: { count: number; name: string | null } | null;
    shares: (Omit<SharedShare, "party"> & { party: SharedShare["party"] })[];
  };
  deletedAt: string | null;
}

export interface FixtureSharedGroup {
  key: string;
  id: string;
  name: string;
  participantContactIds: string[];
  defaultSplit: {
    mode: "EQUAL" | "PERCENT";
    shares: { contactId: string | null; percent: number }[];
  };
  // `amount` is the ceiling: what was open the day you gave up, never a figure that moves.
  writeOffs: { contactId: string | null; expenseId: string | null; amount: number }[];
  archivedAt: string | null;
}

export interface FixtureSettlement {
  key: string;
  id: string;
  counterparty: { kind: "CONTACT" | "GUESTS"; contactId: string | null; expenseId: string | null };
  date: string;
  collected: number;
  paid: number;
  outsideApp: boolean;
  // An instruction to whoever seeds the fixture, not an API field: no feed carries it.
  afterWriteOffs: boolean;
  deletedAt: string | null;
}

export interface ExpectedPerson {
  key: string;
  contactId: string | null;
  expenseId: string | null;
  owesYou: number;
  youOwe: number;
  surplus: number;
  state: "NOT_PAID" | "PARTIALLY_PAID" | "PAID" | "WRITTEN_OFF";
}

export interface ExpectedSharedGroup {
  key: string;
  id: string;
  amount: number;
  yourShare: number;
  owedToYou: number;
  youOwe: number;
  collected: number;
  writtenOff: number;
  status: "OPEN" | "SETTLED";
  people: ExpectedPerson[];
}

export interface ParityFixture {
  id: string;
  title: string;
  user: { id: string; timezone: string; currency: string; minorUnits: number };
  accounts: FixtureAccount[];
  categories: FixtureCategory[];
  transactions: FixtureTransaction[];
  budgets: FixtureBudget[];
  // The four of the shared layer. Absent from the scenarios written before it existed.
  contacts?: FixtureContact[];
  sharedGroups?: FixtureSharedGroup[];
  sharedExpenses?: FixtureSharedExpense[];
  settlements?: FixtureSettlement[];
  expected: {
    balances: { key: string; accountId: string; balance: number }[];
    pending: { count: number; total: number; transactionIds: string[] };
    spending: ExpectedSpending[];
    lists: ExpectedList[];
    budgets: { reference: string; views: ExpectedBudgetView[] };
    countsAsYours?: { key: string; transactionId: string; amount: number }[];
    shared?: ExpectedSharedGroup[];
  };
}

// A JSON import widens every enum to string, so the shape is asserted once here.
export const PARITY_FIXTURES = [
  copBogota,
  copShared,
  eurMadrid,
  jpyTokyo,
  usdNewYork,
] as unknown[] as [ParityFixture, ParityFixture, ParityFixture, ParityFixture, ParityFixture];

/**
 * The movements a settle-up writes. Their ids are minted on the server, so no fixture row can name
 * them and none is written; a mirror holding the real feed has them among `transactions`, and
 * `expected.balances` counts them. Every settle-up of a fixture names the default account.
 */
function settlementRows(fixture: ParityFixture): FixtureTransaction[] {
  const into = fixture.accounts.find((account) => account.isDefault)?.id ?? null;
  return (fixture.settlements ?? [])
    .filter((one) => one.deletedAt === null && !one.outsideApp)
    .map((one, index) => {
      const moved = one.collected - one.paid;
      return {
        key: `settlement:${one.key}`,
        id: `settlement-${index}`,
        type: "SETTLEMENT",
        amount: Math.abs(moved),
        date: one.date,
        dayKey: one.date.slice(0, 10),
        description: null,
        categoryId: null,
        fromAccountId: moved < 0 ? into : null,
        toAccountId: moved < 0 ? null : into,
        tags: [],
        currency: fixture.user.currency,
        source: "MANUAL",
        pendingDetails: false,
        deletedAt: null,
      };
    });
}

// Everything the mirror would hold for this scenario, which is what every figure is derived from.
export const mirrorRows = (fixture: ParityFixture): FixtureTransaction[] => [
  ...fixture.transactions,
  ...settlementRows(fixture),
];

export function parityFixture(id: string): ParityFixture {
  const fixture = PARITY_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`No parity fixture named ${id}`);
  return fixture;
}
