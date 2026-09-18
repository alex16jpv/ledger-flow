import { type AccountsSplit, splitAccounts } from "@/lib/accounts/debt";
import type { Account } from "@/types/api";

export interface AccountsSummary extends AccountsSplit {
  active: Account[];
  archived: Account[];
}

// Display aggregation of balances the server already computed, as the home screen does; never a money rule.
export function summarizeAccounts(accounts: readonly Account[]): AccountsSummary {
  const active = accounts
    .filter((account) => !account.archivedAt)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const archived = accounts.filter((account) => Boolean(account.archivedAt));
  return { active, archived, ...splitAccounts(active) };
}

export function findActiveByName(accounts: readonly Account[], name: string): Account | undefined {
  const needle = name.trim().toLocaleLowerCase();
  return accounts.find(
    (account) => !account.archivedAt && account.name.trim().toLocaleLowerCase() === needle,
  );
}
