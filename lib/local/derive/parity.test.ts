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
  type FixtureSettlement,
  type FixtureSharedExpense,
  type FixtureTransaction,
  mirrorRows,
  PARITY_FIXTURES,
  type ParityFixture,
  parityFixture,
} from "./fixtures";
import { sumAmounts } from "./money";
import { countsAsYours, deriveShared, resolveShares } from "./shared";
import { deriveSpending } from "./spending";

const VENDORED = resolve(process.cwd(), "lib/local/derive/fixtures");
// The guard below runs only where both repos are checked out side by side; elsewhere there is none.
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

// The fixture keeps the offset the user typed; the feed prints UTC, so the stamp normalises here.
function feedRow(userId: string, row: FixtureTransaction): SyncTransaction {
  const date = new Date(row.date).toISOString();
  return transaction({
    id: row.id,
    type: row.type,
    amount: row.amount,
    date,
    // The day the server froze in the user's zone, which is the fixture's, not the helper's default.
    dayKey: row.dayKey,
    description: row.description,
    categoryId: row.categoryId,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    tags: row.tags,
    currency: row.currency,
    source: row.source,
    pendingDetails: row.pendingDetails,
    // What the row is left counting as; absent on a movement that was never split.
    countsAsYours: row.countsAsYours ?? row.amount,
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
      contacts: [],
      sharedGroups: [],
      sharedExpenses: [],
      settlements: [],
    },
    pagination: { limit: 500, count: transactions.length, hasMore: false, nextCursor: "v1|done|" },
  };
}

// `effectiveFrom` is pulled back to the epoch: the expectations are the views, with no floor.
async function vaultOf(fixture: ParityFixture) {
  const userId = fixture.user.id;
  const vault = await openTestVault(userId);
  await pullChanges(vault, {
    fetchPage: () =>
      Promise.resolve(
        feedPage(
          mirrorRows(fixture).map((row) => feedRow(userId, row)),
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
    expect(deriveBalances(fixture.accounts, mirrorRows(fixture))).toEqual(
      fixture.expected.balances.map(({ accountId, balance }) => ({ accountId, balance })),
    );
  });

  it.each(fixture.expected.spending)("derives the $name buckets", (expected) => {
    // `type: null` is the service's everything but ADJUSTMENT and SETTLEMENT, which no URL asks for.
    expect(
      deriveSpending(mirrorRows(fixture), {
        groupBy: expected.query.groupBy,
        type: expected.query.type,
        categoryIds: expected.query.categoryIds ?? undefined,
        splitBy: expected.query.splitBy,
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
          mirrorRows(fixture),
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

  // The derivation can be right while the rows the mirror hands it are the wrong ones.
  it.each(fixture.expected.spending.filter((entry) => entry.query.type !== null))(
    "answers $name through the repository",
    async (expected) => {
      await vaultOf(fixture);
      await expect(
        readSpending({
          groupBy: expected.query.groupBy,
          type: expected.query.type ?? undefined,
          categoryIds: expected.query.categoryIds?.join(","),
          splitBy: expected.query.splitBy ?? undefined,
          from: expected.query.from,
          to: expected.query.to,
        }),
      ).resolves.toEqual({
        groupBy: expected.query.groupBy,
        splitBy: expected.query.splitBy,
        total: expected.total,
        buckets: expected.buckets,
      });
    },
  );

  // The five biggest of a period is one request on purpose: walking every page is what rule 24 forbids.
  it.each(fixture.expected.lists)("answers the $name page through the repository", async (list) => {
    await vaultOf(fixture);
    const page = await readTransactions({
      sort: list.query.sort,
      order: list.query.order,
      type: list.query.type ?? undefined,
      categoryIds: list.query.categoryIds?.join(","),
      from: list.query.from,
      to: list.query.to,
      limit: list.query.limit,
    });
    expect(page.data.map((row) => row.id)).toEqual(list.transactionIds);
  });

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

  // The tray is the repository's own answer, so the fixture checks that path, not a second sum.
  it("answers the pending tray from the mirror exactly as the fixture says", async () => {
    const vault = await openTestVault(fixture.user.id);
    const rows = mirrorRows(fixture).map((row) => feedRow(fixture.user.id, row));
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
    expect(balanceOf(bogota, "cash")).toBe(169000);
    expect(balanceOf(bogota, "cash", withoutAdjustments)).toBe(161500);
  });

  it("moves both ends of a TRANSFER", () => {
    const withoutTransfers = bogota.transactions.filter(
      (transaction) => transaction.type !== "TRANSFER",
    );
    expect(balanceOf(bogota, "savings")).toBe(5500000);
    expect(balanceOf(bogota, "savings", withoutTransfers)).toBe(5000000);
    expect(balanceOf(bogota, "card", withoutTransfers)).toBe(balanceOf(bogota, "card") - 300000);
    expect(balanceOf(bogota, "bank", withoutTransfers)).toBe(balanceOf(bogota, "bank") + 800000);
  });
});

describe("the vendored copy", () => {
  it("holds the five scenarios", () => {
    expect(PARITY_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "cop-bogota",
      "cop-shared",
      "eur-madrid",
      "jpy-tokyo",
      "usd-new-york",
    ]);
  });

  it.runIf(existsSync(SOURCE))(
    "is byte for byte the backend's committed fixtures/offline (skipped where that repo is absent)",
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

const SHARED_FIXTURES = PARITY_FIXTURES.filter((fixture) => fixture.expected.shared !== undefined);

// The payer's share is the one that absorbs the odd minor unit, in every mode.
const payerIndexOf = (expense: FixtureSharedExpense): number =>
  expense.split.shares.findIndex((share) =>
    expense.paidByContactId === null
      ? share.party === "USER"
      : share.party === "CONTACT" && share.contactId === expense.paidByContactId,
  );

const statedInput = (
  mode: FixtureSharedExpense["split"]["mode"],
  share: FixtureSharedExpense["split"]["shares"][number],
): number | null => {
  if (mode === "EQUAL") return null;
  if (mode === "PERCENT") return share.percent;
  return share.fixedAmount;
};

describe.each(SHARED_FIXTURES)("$id · the shared layer", (fixture) => {
  const groups = fixture.sharedGroups ?? [];
  const expenses = fixture.sharedExpenses ?? [];
  const settlements: FixtureSettlement[] = fixture.settlements ?? [];
  const ledger = deriveShared({ groups, expenses, settlements });

  it("resolves every split to the figures the server stored", () => {
    for (const expense of expenses) {
      const shares = resolveShares({
        total: expense.amount,
        currency: fixture.user.currency,
        mode: expense.split.mode,
        rows: expense.split.shares.map((share) => ({
          // A block of guests weighs as many parts as it counts, and never takes the remainder.
          units: share.party === "GUESTS" ? (expense.split.guests?.count ?? 1) : 1,
          input: statedInput(expense.split.mode, share),
        })),
        payerIndex: payerIndexOf(expense),
      });
      expect({ key: expense.key, shares }).toEqual({
        key: expense.key,
        shares: expense.split.shares.map((share) => share.amount),
      });
    }
  });

  it("imputes every payment onto the shares exactly as the server did", () => {
    for (const expense of expenses.filter((row) => row.deletedAt === null)) {
      for (const share of expense.split.shares) {
        const key =
          share.party === "USER"
            ? "user"
            : share.party === "GUESTS"
              ? `guests:${expense.id}`
              : `contact:${share.contactId}`;
        expect({
          expense: expense.key,
          key,
          collected: ledger.collected.get(`${expense.id}|${key}`),
        }).toEqual({ expense: expense.key, key, collected: share.collected });
      }
    }
  });

  it("derives what every movement counts as yours", () => {
    const linked = new Map(
      expenses.filter((row) => row.deletedAt === null).map((row) => [row.id, row.transactionId]),
    );
    const expenseOf = (transactionId: string): string | null =>
      [...linked].find(([, id]) => id === transactionId)?.[0] ?? null;
    expect(
      fixture.transactions
        .filter((row) => row.deletedAt === null)
        .map((row) => ({
          key: row.key,
          amount: countsAsYours({ amount: row.amount, sharedExpenseId: expenseOf(row.id) }, ledger),
        })),
    ).toEqual((fixture.expected.countsAsYours ?? []).map(({ key, amount }) => ({ key, amount })));
  });

  it("derives where every group and every person stands", () => {
    // The fixture pins the money and the people; the range and the count are the endpoint's own.
    const pinned = ledger.groups.map((group) => ({
      id: group.id,
      amount: group.amount,
      yourShare: group.yourShare,
      owedToYou: group.owedToYou,
      youOwe: group.youOwe,
      collected: group.collected,
      writtenOff: group.writtenOff,
      status: group.status,
      people: group.people,
    }));
    expect(pinned).toEqual(
      (fixture.expected.shared ?? []).map((group) => ({
        id: group.id,
        amount: group.amount,
        yourShare: group.yourShare,
        owedToYou: group.owedToYou,
        youOwe: group.youOwe,
        collected: group.collected,
        writtenOff: group.writtenOff,
        status: group.status,
        people: group.people,
      })),
    );
  });
});
