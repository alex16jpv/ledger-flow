type TransactionBase = {
  id: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  date: Date;
  category?: string;
  description?: string;
  user_id?: string;
};

type TransferTransaction = TransactionBase & {
  type: "TRANSFER";
  from_account_id: string;
  to_account_id: string;
};

type IncomeTransaction = TransactionBase & {
  type: "INCOME";
  to_account_id: string;
  from_account_id?: never;
};

type ExpenseTransaction = TransactionBase & {
  type: "EXPENSE";
  from_account_id: string;
  to_account_id?: never;
};

export type TransactionType =
  | TransferTransaction
  | IncomeTransaction
  | ExpenseTransaction;
