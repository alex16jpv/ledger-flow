import type { SyncTransaction } from "@/types/api";

import { fromCents, toCents } from "./money";

// The fields the figure needs: this runs over the mirror and over the parity fixtures.
export interface BalanceAccount {
  id: string;
  openingBalance: number;
}

export type BalanceTransaction = Pick<
  SyncTransaction,
  "type" | "amount" | "fromAccountId" | "toAccountId" | "deletedAt"
>;

export interface AccountBalance {
  accountId: string;
  balance: number;
}

// Invariant 2: a projection, never a figure the server sent, and whatever paints it marks it.
export function deriveBalances(
  accounts: BalanceAccount[],
  transactions: BalanceTransaction[],
): AccountBalance[] {
  const cents = new Map(accounts.map((account) => [account.id, toCents(account.openingBalance)]));
  const move = (accountId: string | null, delta: number): void => {
    if (accountId === null) return;
    const current = cents.get(accountId);
    // A row naming an account the mirror never saw cannot invent one.
    if (current === undefined) return;
    cents.set(accountId, current + delta);
  };

  for (const transaction of transactions) {
    // A deleted row leaves every figure, balances included; an archived one still counts.
    if (transaction.deletedAt) continue;
    const amount = toCents(transaction.amount);
    if (transaction.type === "EXPENSE") move(transaction.fromAccountId, -amount);
    else if (transaction.type === "INCOME") move(transaction.toAccountId, amount);
    else {
      // ADJUSTMENT moves balances exactly like a TRANSFER; what it never does is count as spending.
      move(transaction.fromAccountId, -amount);
      move(transaction.toAccountId, amount);
    }
  }

  return accounts.map((account) => ({
    accountId: account.id,
    balance: fromCents(cents.get(account.id) ?? 0),
  }));
}
