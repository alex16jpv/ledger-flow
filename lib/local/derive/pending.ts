import type { SyncTransaction } from "@/types/api";

import { sumAmounts } from "./money";

export type PendingTransaction = Pick<
  SyncTransaction,
  "id" | "amount" | "date" | "pendingDetails" | "deletedAt"
>;

export interface PendingSummary {
  count: number;
  total: number;
  transactionIds: string[];
}

// The quick-add tray: how many rows still need details and what they add up to, oldest first.
export function derivePendingSummary(transactions: PendingTransaction[]): PendingSummary {
  const pending = transactions
    .filter((transaction) => !transaction.deletedAt && transaction.pendingDetails)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return {
    count: pending.length,
    total: sumAmounts(pending.map((transaction) => transaction.amount)),
    transactionIds: pending.map((transaction) => transaction.id),
  };
}
