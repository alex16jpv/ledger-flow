import { type AccountBalance, type BalanceTransaction, deriveBalances } from "../derive";
import { fromCents, toCents } from "../derive/money";
import type { OutboxOperation } from "../schema";
import { operationPayload } from "./envelope";

export interface ProjectedAccount {
  id: string;
  balance: number;
}

// D-18: the rule is borrowed from `deriveBalances`, so the oracle and the screen agree.
export function projectBalances(
  accounts: ProjectedAccount[],
  operations: OutboxOperation[],
): AccountBalance[] {
  const before: BalanceTransaction[] = [];
  const after: BalanceTransaction[] = [];
  for (const operation of operations) {
    const { effect } = operationPayload(operation);
    if (!effect) continue;
    if (effect.before) before.push(effect.before);
    if (effect.after) after.push(effect.after);
  }

  // Opening at zero makes it a pure delta, and sums stay in minor units to the last division.
  const opening = accounts.map((account) => ({ id: account.id, openingBalance: 0 }));
  const added = new Map(deriveBalances(opening, after).map((row) => [row.accountId, row.balance]));
  const removed = new Map(
    deriveBalances(opening, before).map((row) => [row.accountId, row.balance]),
  );

  return accounts.map((account) => ({
    accountId: account.id,
    balance: fromCents(
      toCents(account.balance) +
        toCents(added.get(account.id) ?? 0) -
        toCents(removed.get(account.id) ?? 0),
    ),
  }));
}
