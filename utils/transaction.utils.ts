import { Transaction } from "@/types/Transaction.types";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPES } from "@/utils/constants";

const { EXPENSE, INCOME, TRANSFER } = TRANSACTION_TYPES;

export function getTransactionSubtitle(
  transaction: Transaction,
  accountNames?: Map<string, string>,
): string {
  const label = TRANSACTION_TYPE_LABELS[transaction.type];
  const resolveAccountName = (id?: string | null) =>
    id ? (accountNames?.get(id) ?? id) : "—";

  switch (transaction.type) {
    case TRANSFER:
      return `${label} · ${resolveAccountName(transaction.fromAccountId)} → ${resolveAccountName(transaction.toAccountId)}`;
    case INCOME:
      return `${label} · ${resolveAccountName(transaction.toAccountId)}`;
    case EXPENSE:
      return `${label} · ${resolveAccountName(transaction.fromAccountId)}`;
  }
}
