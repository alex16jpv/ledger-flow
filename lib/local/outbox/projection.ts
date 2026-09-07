import { type AccountBalance, type BalanceTransaction, deriveBalances } from "../derive";
import { fromCents, toCents } from "../derive/money";
import type { OutboxOperation } from "../schema";
import { operationPayload } from "./envelope";

export interface ProjectedAccount {
  id: string;
  balance: number;
}

// The server's `balance` from the mirror plus the effect of the operations it has not seen. The
// rule is borrowed from `deriveBalances` rather than restated, so the oracle and the screen's
// recipe agree by construction (D-18); with an empty queue this is the server's own figure.
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

  // Opening at zero turns the oracle into a pure delta, and the sums stay in minor units until the
  // single division at the end: adding two rounded floats is how a cent goes missing.
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
