import { type TransactionKind } from "@/utils/constants";
export type { TransactionKind };

export type Transaction = {
  id: string;
  type: TransactionKind;
  amount: number;
  date: string;
  categoryId?: string | null;
  description?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  userId?: string;
  tags?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
