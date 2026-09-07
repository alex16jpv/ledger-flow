import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, openTestVault, profile, wipeVaults } from "@/lib/testing/vault";
import type { SyncTransaction } from "@/types/api";

import { deriveBalances } from "../derive";
import { PARITY_FIXTURES, type ParityFixture, parityFixture } from "../derive/fixtures";
import { setCurrentVault } from "../repository/read";
import { accountRecord, profileRecord, transactionRecord } from "../schema";
import { projectBalances } from "./projection";
import { pendingOperations } from "./queue";
import { createTransaction, deleteTransaction, updateTransaction } from "./transactions";

// The fixture keeps each date in the offset the user typed; the feed prints UTC and the mirror
// stores what the feed sends.
function mirrorRow(userId: string, currency: string, row: ParityFixture["transactions"][number]) {
  const date = new Date(row.date).toISOString();
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    date,
    categoryId: row.categoryId,
    description: row.description,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    userId,
    tags: row.tags,
    note: null,
    pendingDetails: row.pendingDetails,
    source: row.source,
    currency,
    deletedAt: row.deletedAt,
    createdAt: date,
    updatedAt: date,
  } satisfies SyncTransaction;
}

// The mirror holds the balance the server sent, which is the oracle's figure over the same rows.
function serverBalances(fixture: ParityFixture) {
  const derived = deriveBalances(fixture.accounts, fixture.transactions);
  return fixture.accounts.map((row) => ({
    ...row,
    balance: derived.find((entry) => entry.accountId === row.id)?.balance ?? 0,
  }));
}

async function vaultOf(fixture: ParityFixture) {
  const vault = await openTestVault(fixture.user.id);
  await vault.db.put(
    "profile",
    profileRecord(
      profile({
        id: fixture.user.id,
        timezone: fixture.user.timezone,
        currency: fixture.user.currency,
      }),
    ),
  );
  for (const row of serverBalances(fixture)) {
    await vault.db.put(
      "accounts",
      accountRecord(
        account({
          id: row.id,
          balance: row.balance,
          openingBalance: row.openingBalance,
          currency: fixture.user.currency,
          userId: fixture.user.id,
          archivedAt: row.archivedAt,
          isDefault: row.id === fixture.accounts[0]?.id,
        }),
      ),
    );
  }
  for (const row of fixture.transactions) {
    await vault.db.put(
      "transactions",
      transactionRecord(mirrorRow(fixture.user.id, fixture.user.currency, row)),
    );
  }
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  setCurrentVault(vault);
  reportOnline(false);
  return vault;
}

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  await wipeVaults();
});

describe("the balance projection", () => {
  it.each(PARITY_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "is the mirror's own figure with an empty queue (%s)",
    (_id, fixture) => {
      const oracle = deriveBalances(fixture.accounts, fixture.transactions);

      expect(projectBalances(serverBalances(fixture), [])).toEqual(oracle);
      expect(oracle).toEqual(
        fixture.expected.balances.map(({ accountId, balance }) => ({ accountId, balance })),
      );
    },
  );

  it("agrees with the oracle over the optimistic rows once the queue is not empty", async () => {
    const fixture = parityFixture("eur-madrid");
    const vault = await vaultOf(fixture);
    const [first, second] = fixture.transactions;

    await createTransaction(
      {
        type: "EXPENSE",
        amount: 41.55,
        date: "2026-03-10T12:00:00.000Z",
        fromAccountId: fixture.accounts[0]!.id,
      },
      "11111111-1111-7111-8111-111111111111",
    );
    await updateTransaction(first!.id, { amount: first!.amount + 13.13 });
    await deleteTransaction(second!.id);

    const operations = await pendingOperations(vault.db);
    const accounts = (await vault.db.getAll("accounts")).map((record) => record.row);
    const optimistic = (await vault.db.getAll("transactions")).map((record) => record.row);

    expect(operations).toHaveLength(3);
    expect(projectBalances(accounts, operations)).toEqual(
      deriveBalances(fixture.accounts, optimistic),
    );
  });

  it("leaves an account no queued operation touches exactly where the server left it", async () => {
    const fixture = parityFixture("cop-bogota");
    const vault = await vaultOf(fixture);
    const untouched = fixture.accounts.at(-1)!;

    await createTransaction(
      {
        type: "EXPENSE",
        amount: 9.99,
        date: "2026-03-10T12:00:00.000Z",
        fromAccountId: fixture.accounts[0]!.id,
      },
      "22222222-2222-7222-8222-222222222222",
    );

    const accounts = (await vault.db.getAll("accounts")).map((record) => record.row);
    const projected = projectBalances(accounts, await pendingOperations(vault.db));
    const before = serverBalances(fixture).find((row) => row.id === untouched.id);

    expect(projected.find((row) => row.accountId === untouched.id)?.balance).toBe(before?.balance);
  });
});
