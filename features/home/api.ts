import {
  readAccounts,
  readBudgets,
  readCategories,
  readSpending,
  readTransactions,
} from "@/lib/local/repository";
import type { Account, Budget, Category, StatsResponse, TransactionList } from "@/types/api";

export interface SpendingParams {
  from: string;
  to: string;
  type: "EXPENSE" | "INCOME";
  groupBy?: "category" | "day" | "tag";
}

export function fetchSpending({ from, to, type, groupBy }: SpendingParams): Promise<StatsResponse> {
  return readSpending({ from, to, type, groupBy });
}

export function fetchHomeAccounts(): Promise<Account[]> {
  return readAccounts();
}

export function fetchHomeBudgets(reference: string): Promise<Budget[]> {
  return readBudgets({ reference });
}

export function fetchHomeCategories(): Promise<Category[]> {
  return readCategories({ includeArchived: true });
}

export function fetchHomePending(): Promise<TransactionList> {
  return readTransactions({ pendingDetails: true, limit: 1, includeSummary: true });
}
