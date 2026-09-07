import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import {
  budget as budgetRow,
  category as categoryRow,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { Category, SyncBudget, SyncChangesResponse, SyncTransaction, User } from "@/types/api";

import { pullChanges } from "../pull";
import { readBudgets, readSpending, readTransactions, setCurrentVault } from "../repository";
import { deriveBalances } from "./balances";
import { deriveBudgetView } from "./budgets";
import {
  type FixtureBudget,
  type FixtureCategory,
  type FixtureTransaction,
  PARITY_FIXTURES,
  type ParityFixture,
  parityFixture,
} from "./fixtures";
import { sumAmounts } from "./money";
import { deriveSpending } from "./spending";

const VENDORED = resolve(process.cwd(), "lib/local/derive/fixtures");
// The backend's committed copy, which `npm run fixtures:sync` copies here. The guard below runs only
// where both repos are checked out side by side: in CI there is nothing to compare against.
const SOURCE = resolve(
  process.env.OFFLINE_FIXTURES_DIR ?? join(process.cwd(), "../lag-money-manager/fixtures/offline"),
);

const bogota = parityFixture("cop-bogota");
const madrid = parityFixture("eur-madrid");

function balanceOf(fixture: typeof bogota, key: string, rows = fixture.transactions) {
  const account = fixture.accounts.find((candidate) => candidate.key === key)!;
  return deriveBalances(fixture.accounts, rows).find((entry) => entry.accountId === account.id)!
    .balance;
}

// A fixture row is the feed row minus its human `key` and the audit fields, which the tray never
// reads. The fixture keeps each date in the offset the user typed it in; the feed prints UTC, and
// the mirror stores what the feed sends, so the stamp is normalised here and not anywhere later.
function feedRow(userId: string, row: FixtureTransaction): SyncTransaction {
  const date = new Date(row.date).toISOString();
  return transaction({
    id: row.id,
    type: row.type,
    amount: row.amount,
    date,
    description: row.description,
    categoryId: row.categoryId,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    tags: row.tags,
    currency: row.currency,
    source: row.source,
    pendingDetails: row.pendingDetails,
    deletedAt: row.deletedAt,
    userId,
    createdAt: date,
    updatedAt: date,
  });
}

function feedCategory(userId: string, row: FixtureCategory): Category {
  return categoryRow({
    id: row.id,
    name: row.name,
    type: row.type,
    archivedAt: row.archivedAt,
    userId,
  });
}

function feedBudget(userId: string, row: FixtureBudget): SyncBudget {
  return budgetRow({
    id: row.id,
    name: row.name,
    type: row.type,
    categoryIds: row.categoryIds,
    amount: row.amount,
    amountOverrides: row.amountOverrides,
    currency: row.currency,
    periodType: row.periodType,
    periodStartDate: row.periodStartDate,
    periodEndDate: row.periodEndDate,
    effectiveFrom: row.effectiveFrom,
    archivedAt: row.archivedAt,
    userId,
  });
}

function feedPage(
  transactions: SyncTransaction[],
  extra: { user?: User; categories?: Category[]; budgets?: SyncBudget[] } = {},
): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: {
      user: extra.user ?? null,
      accounts: [],
      categories: extra.categories ?? [],
      transactions,
      budgets: extra.budgets ?? [],
    },
    pagination: { limit: 500, count: transactions.length, hasMore: false, nextCursor: "v1|done|" },
  };
}

// The whole scenario in a vault, so a read can be checked through the path a screen actually takes.
// `effectiveFrom` is pulled back to the epoch: the fixture's expectations are the views themselves,
// with none of the list's lifetime-floor filtering applied to them.
async function vaultOf(fixture: ParityFixture) {
  const userId = fixture.user.id;
  const vault = await openTestVault(userId);
  await pullChanges(vault, {
    fetchPage: () =>
      Promise.resolve(
        feedPage(
          fixture.transactions.map((row) => feedRow(userId, row)),
          {
            user: profile({
              id: userId,
              timezone: fixture.user.timezone,
              currency: fixture.user.currency,
            }),
            categories: fixture.categories.map((row) => feedCategory(userId, row)),
            budgets: fixture.budgets.map((row) => ({
              ...feedBudget(userId, row),
              effectiveFrom: "1970-01-01T00:00:00.000Z",
            })),
          },
        ),
      ),
  });
  setCurrentVault(vault);
  reportOnline(false);
  return vault;
}

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  await wipeVaults();
});

describe.each(PARITY_FIXTURES)("$id", (fixture) => {
  it("derives every account balance", () => {
    expect(deriveBalances(fixture.accounts, fixture.transactions)).toEqual(
      fixture.expected.balances.map(({ accountId, balance }) => ({ accountId, balance })),
    );
  });

  it.each(fixture.expected.spending)("derives the $name buckets", (expected) => {
    // The query is read from the fixture, never invented: `type: null` is the service's "everything
    // but ADJUSTMENT", which no URL can ask for.
    expect(
      deriveSpending(fixture.transactions, {
        groupBy: expected.query.groupBy,
        type: expected.query.type,
        from: expected.query.from,
        to: expected.query.to,
        timeZone: expected.query.timezone,
      }),
    ).toEqual({ total: expected.total, buckets: expected.buckets });
  });

  it("derives every budget view as of the fixture's reference", () => {
    const reference = new Date(fixture.expected.budgets.reference);
    const archived = new Set(
      fixture.categories.filter((row) => row.archivedAt !== null).map((row) => row.id),
    );
    // An archived budget produces no view at all, which is why the fixture lists none.
    const views = fixture.budgets
      .filter((row) => row.archivedAt === null)
      .map((row) => {
        const view = deriveBudgetView(
          row,
          fixture.transactions,
          archived,
          reference,
          fixture.user.timezone,
        );
        return {
          key: row.key,
          id: row.id,
          periodKey: view.periodKey,
          periodFrom: view.periodFrom.toISOString(),
          periodTo: view.periodTo.toISOString(),
          baseAmount: view.baseAmount,
          amount: view.amount,
          hasOverride: view.hasOverride,
          spent: view.spent,
          expired: view.expired,
          archivedCategoryIds: view.archivedCategoryIds,
        };
      });
    expect(views).toEqual(fixture.expected.budgets.views);
  });

  // Reading through the repository is the other half: the derivation can be right while the rows
  // the mirror hands it are the wrong ones. The queries a URL can express are checked this way.
  it.each(fixture.expected.spending.filter((entry) => entry.query.type !== null))(
    "answers $name through the repository",
    async (expected) => {
      await vaultOf(fixture);
      await expect(
        readSpending({
          groupBy: expected.query.groupBy,
          type: expected.query.type ?? undefined,
          from: expected.query.from,
          to: expected.query.to,
        }),
      ).resolves.toEqual({
        groupBy: expected.query.groupBy,
        total: expected.total,
        buckets: expected.buckets,
      });
    },
  );

  it("answers every budget's spent through the repository", async () => {
    await vaultOf(fixture);
    const views = await readBudgets({
      reference: fixture.expected.budgets.reference,
      includeExpired: true,
    });
    expect(
      views.map(({ id, periodKey, periodFrom, periodTo, amount, spent, hasOverride, expired }) => ({
        id,
        periodKey,
        periodFrom,
        periodTo,
        amount,
        spent,
        hasOverride,
        expired,
      })),
    ).toEqual(
      fixture.expected.budgets.views.map((view) => ({
        id: view.id,
        periodKey: view.periodKey,
        periodFrom: view.periodFrom,
        periodTo: view.periodTo,
        amount: view.amount,
        spent: view.spent,
        hasOverride: view.hasOverride,
        expired: view.expired,
      })),
    );
  });

  // The tray is the repository's own answer to the list endpoint, so the fixture is checked against
  // that path and not against a second derivation of the same figure.
  it("answers the pending tray from the mirror exactly as the fixture says", async () => {
    const vault = await openTestVault(fixture.user.id);
    const rows = fixture.transactions.map((row) => feedRow(fixture.user.id, row));
    await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(rows)) });
    setCurrentVault(vault);
    reportOnline(false);

    const tray = await readTransactions({ pendingDetails: true, limit: 100, includeSummary: true });

    expect(tray.pagination.total).toBe(fixture.expected.pending.count);
    expect(tray.summary?.totalAmount).toBe(fixture.expected.pending.total);
    expect(tray.data.map((row) => row.id).sort()).toEqual(
      [...fixture.expected.pending.transactionIds].sort(),
    );
  });
});

describe("minor units", () => {
  // The one figure in the four fixtures a running float sum actually gets wrong.
  it("adds a balance where a running float sum drifts", () => {
    expect(1000 - 10.1 + 1500 - 7.77 - 100 - 3.45).not.toBe(2378.68);
    expect(balanceOf(madrid, "current")).toBe(2378.68);
  });

  it("adds in the currency's own unit at any scale", () => {
    expect(sumAmounts([0.1, 0.2, 19.99, 2.3])).toBe(22.59);
    expect(sumAmounts([30000, 85000, 12500])).toBe(127500);
    expect(sumAmounts([])).toBe(0);
  });
});

describe("the rules the fixtures fix", () => {
  it("leaves a deleted row out of every balance", () => {
    const live = bogota.transactions.filter((transaction) => !transaction.deletedAt);
    expect(deriveBalances(bogota.accounts, bogota.transactions)).toEqual(
      deriveBalances(bogota.accounts, live),
    );
  });

  it("still balances an archived account", () => {
    const closed = bogota.accounts.find((account) => account.archivedAt !== null)!;
    expect(deriveBalances(bogota.accounts, bogota.transactions)).toContainEqual({
      accountId: closed.id,
      balance: 0,
    });
  });

  it("moves a balance with an ADJUSTMENT", () => {
    const withoutAdjustments = bogota.transactions.filter(
      (transaction) => transaction.type !== "ADJUSTMENT",
    );
    expect(balanceOf(bogota, "cash")).toBe(181000);
    expect(balanceOf(bogota, "cash", withoutAdjustments)).toBe(173500);
  });

  it("moves both ends of a TRANSFER", () => {
    const withoutTransfers = bogota.transactions.filter(
      (transaction) => transaction.type !== "TRANSFER",
    );
    expect(balanceOf(bogota, "savings")).toBe(5500000);
    expect(balanceOf(bogota, "savings", withoutTransfers)).toBe(5000000);
    expect(balanceOf(bogota, "bank", withoutTransfers)).toBe(balanceOf(bogota, "bank") + 500000);
  });
});

describe("the vendored copy", () => {
  it("holds the four scenarios", () => {
    expect(PARITY_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "cop-bogota",
      "eur-madrid",
      "jpy-tokyo",
      "usd-new-york",
    ]);
  });

  it.runIf(existsSync(SOURCE))(
    "is byte for byte the backend's committed fixtures/offline (skipped where that repo is absent, as in CI)",
    () => {
      expect(readdirSync(VENDORED).sort()).toEqual(readdirSync(SOURCE).sort());
      for (const file of readdirSync(SOURCE)) {
        expect({ file, body: readFileSync(join(VENDORED, file), "utf8") }).toEqual({
          file,
          body: readFileSync(join(SOURCE, file), "utf8"),
        });
      }
    },
  );
});
