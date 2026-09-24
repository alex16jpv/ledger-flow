import { type AccountBalance, type BalanceTransaction, deriveBalances } from "../derive";
import { fromCents, toCents } from "../derive/money";
import type { OutboxOperation } from "../schema";
import { type MoneyEffect, operationPayload } from "./envelope";
import { refused } from "./projected";
import type { WriteTransaction } from "./queue";
import { willBeSent } from "./reproject";

export interface ProjectedAccount {
  id: string;
  balance: number;
}

// D-18: the rule is borrowed from `deriveBalances`, so the oracle and the screen agree.
export function projectBalances(
  accounts: ProjectedAccount[],
  operations: OutboxOperation[],
): AccountBalance[] {
  const effects: MoneyEffect[] = [];
  for (const operation of operations) {
    const { effect } = operationPayload(operation);
    if (effect) effects.push(effect);
  }
  return applyEffects(accounts, effects);
}

function applyEffects(accounts: ProjectedAccount[], effects: MoneyEffect[]): AccountBalance[] {
  const before: BalanceTransaction[] = [];
  const after: BalanceTransaction[] = [];
  for (const effect of effects) {
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

// T-156: the server caps a loan on where a write leaves it, so the mirror refuses what it would.
export async function refuseLoanInCredit(tx: WriteTransaction, effect: MoneyEffect): Promise<void> {
  const touched = new Set<string>();
  for (const side of [effect.before, effect.after]) {
    if (side?.fromAccountId) touched.add(side.fromAccountId);
    if (side?.toAccountId) touched.add(side.toAccountId);
  }
  if (touched.size === 0) return;
  const queued = (await tx.objectStore("outbox").getAll()).filter(willBeSent);
  for (const id of touched) {
    const record = await tx.objectStore("accounts").get(id);
    if (record?.row.type !== "LOAN") continue;
    const [now] = projectBalances([{ id, balance: record.row.balance }], queued);
    const [next] = applyEffects([{ id, balance: now?.balance ?? record.row.balance }], [effect]);
    const from = toCents(now?.balance ?? record.row.balance);
    const to = toCents(next?.balance ?? 0);
    if (to > from && to > 0) {
      throw refused(
        "LOAN_OVERPAID",
        "A loan cannot end above zero: it cannot be paid more than it still owes",
      );
    }
  }
}
