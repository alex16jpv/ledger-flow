import type { Account, Transaction } from "@/types/api";

export interface EditingAdjustment {
  transaction: Transaction;
  account: Account;
}

// T-89: an adjustment row opens the account's Adjust balance sheet instead of the transaction form.
export function editingAdjustment(
  transaction: Transaction,
  accounts: ReadonlyMap<string, Account>,
): EditingAdjustment | null {
  if (transaction.type !== "ADJUSTMENT") return null;
  const account = accounts.get(transaction.fromAccountId ?? transaction.toAccountId ?? "");
  return account ? { transaction, account } : null;
}

export type AdjustmentDirection = "increase" | "decrease";

export function directionOf(adjustment: Pick<Transaction, "toAccountId">): AdjustmentDirection {
  return adjustment.toAccountId ? "increase" : "decrease";
}
