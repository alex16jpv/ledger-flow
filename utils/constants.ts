import { TypeTransactionType } from "@/types/Transaction.types";

export const TRANSACTION_TYPES: {
  [key in TypeTransactionType]: TypeTransactionType;
} = {
  EXPENSE: "EXPENSE",
  INCOME: "INCOME",
  TRANSFER: "TRANSFER",
};

export const TRANSACTION_TYPE_LABELS = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
} as const;
