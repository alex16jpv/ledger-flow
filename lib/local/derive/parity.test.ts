import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { deriveBalances } from "./balances";
import { PARITY_FIXTURES, parityFixture } from "./fixtures";
import { sumAmounts } from "./money";
import { derivePendingSummary } from "./pending";

const VENDORED = resolve(process.cwd(), "lib/local/derive/fixtures");
// What `npm run fixtures:offline` regenerates from the backend. It lives in no repository, so the
// guard below only runs where it exists: in CI there is nothing to compare against.
const SOURCE = resolve(process.cwd(), "../auditoria/offline-fixtures");

const bogota = parityFixture("cop-bogota");
const madrid = parityFixture("eur-madrid");

function balanceOf(fixture: typeof bogota, key: string, rows = fixture.transactions) {
  const account = fixture.accounts.find((candidate) => candidate.key === key)!;
  return deriveBalances(fixture.accounts, rows).find((entry) => entry.accountId === account.id)!
    .balance;
}

describe.each(PARITY_FIXTURES)("$id", (fixture) => {
  it("derives every account balance", () => {
    expect(deriveBalances(fixture.accounts, fixture.transactions)).toEqual(
      fixture.expected.balances.map(({ accountId, balance }) => ({ accountId, balance })),
    );
  });

  it("derives the pending summary", () => {
    expect(derivePendingSummary(fixture.transactions)).toEqual(fixture.expected.pending);
  });
});

describe("minor units", () => {
  // The one figure in the four fixtures a running float sum actually gets wrong; the example the
  // fixtures README offers, 0.10 + 0.20 + 19.99 + 2.30, comes back exact in floats.
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

  it("leaves a deleted row out of the tray", () => {
    const [first, ...rest] = derivePendingSummary(bogota.transactions).transactionIds;
    const deleted = bogota.transactions.map((transaction) =>
      transaction.id === first
        ? { ...transaction, deletedAt: "2026-08-21T00:00:00.000-05:00" }
        : transaction,
    );
    expect(derivePendingSummary(deleted).transactionIds).toEqual(rest);
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
    "is byte for byte the folder the backend regenerates (skipped where that folder is absent, as in CI)",
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
