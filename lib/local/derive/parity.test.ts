import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { openTestVault, transaction, wipeVaults } from "@/lib/testing/vault";
import type { SyncChangesResponse, SyncTransaction } from "@/types/api";

import { pullChanges } from "../pull";
import { readTransactions, setCurrentVault } from "../repository";
import { deriveBalances } from "./balances";
import { type FixtureTransaction, PARITY_FIXTURES, parityFixture } from "./fixtures";
import { sumAmounts } from "./money";

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

// A fixture row is the feed row minus its human `key` and the audit fields, which the tray never reads.
function feedRow(userId: string, row: FixtureTransaction): SyncTransaction {
  return transaction({
    id: row.id,
    type: row.type,
    amount: row.amount,
    date: row.date,
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
    createdAt: row.date,
    updatedAt: row.date,
  });
}

function feedPage(transactions: SyncTransaction[]): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: { user: null, accounts: [], categories: [], transactions, budgets: [] },
    pagination: { limit: 500, count: transactions.length, hasMore: false, nextCursor: "v1|done|" },
  };
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
