import type { Account } from "@/types/api";

export const DEBT_ACCOUNT_TYPES: ReadonlySet<Account["type"]> = new Set([
  "CARD",
  "OVERDRAFT",
  "LOAN",
]);

export interface AccountsSummary {
  active: Account[];
  archived: Account[];
  totalBalance: number;
  cardDebt: number;
}

// Display aggregation of balances the server already computed, as the home screen does; never a money rule.
export function summarizeAccounts(accounts: readonly Account[]): AccountsSummary {
  const active = accounts
    .filter((account) => !account.archivedAt)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const archived = accounts.filter((account) => Boolean(account.archivedAt));
  const totalBalance = active.reduce((sum, account) => sum + account.balance, 0);
  const cardDebt = active
    .filter((account) => DEBT_ACCOUNT_TYPES.has(account.type) && account.balance < 0)
    .reduce((sum, account) => sum + account.balance, 0);
  return { active, archived, totalBalance, cardDebt };
}

export function findActiveByName(accounts: readonly Account[], name: string): Account | undefined {
  const needle = name.trim().toLocaleLowerCase();
  return accounts.find(
    (account) => !account.archivedAt && account.name.trim().toLocaleLowerCase() === needle,
  );
}
