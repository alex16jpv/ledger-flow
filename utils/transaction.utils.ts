import { Transaction } from "@/types/Transaction.types";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPES } from "@/utils/constants";

const { EXPENSE, INCOME, TRANSFER } = TRANSACTION_TYPES;

export function getTransactionSubtitle(transaction: Transaction): string {
  const label = TRANSACTION_TYPE_LABELS[transaction.type];

  if (transaction.type === TRANSFER) {
    return `${label} · ${transaction.from_account_id} → ${transaction.to_account_id}`;
  }

  if (transaction.type === INCOME) {
    return `${label} · ${transaction.to_account_id}`;
  }

  if (transaction.type === EXPENSE) {
    const category = transaction.category ?? "Uncategorized";
    return `${label} · ${category} · ${transaction.from_account_id}`;
  }

  return label;
}
