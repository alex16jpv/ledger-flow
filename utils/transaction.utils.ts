import { Transaction } from "@/types/Transaction.types";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPES } from "@/utils/constants";

const { EXPENSE, INCOME, TRANSFER } = TRANSACTION_TYPES;

export function getTransactionSubtitle(transaction: Transaction): string {
  const label = TRANSACTION_TYPE_LABELS[transaction.type];

  switch (transaction.type) {
    case TRANSFER:
      return `${label} · ${transaction.from_account_id} → ${transaction.to_account_id}`;
    case INCOME:
      return `${label} · ${transaction.to_account_id}`;
    case EXPENSE: {
      return `${label} · ${transaction.from_account_id}`;
    }
  }
}
