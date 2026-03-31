import { Transaction } from "@/types/Transaction.types";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPES } from "@/utils/constants";

const { EXPENSE, INCOME, TRANSFER } = TRANSACTION_TYPES;

export function getTransactionSubtitle(transaction: Transaction): string {
  const label = TRANSACTION_TYPE_LABELS[transaction.type];

  switch (transaction.type) {
    case TRANSFER:
      return `${label} · ${transaction.fromAccountId ?? "—"} → ${transaction.toAccountId ?? "—"}`;
    case INCOME:
      return `${label} · ${transaction.toAccountId ?? "—"}`;
    case EXPENSE:
      return `${label} · ${transaction.fromAccountId ?? "—"}`;
  }
}
