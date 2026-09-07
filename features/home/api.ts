import {
  readAccounts,
  readBudgetsPage,
  readCategoriesPage,
  readSpending,
  readTransactions,
} from "@/lib/local/repository";
import type {
  AccountList,
  BudgetList,
  CategoryList,
  StatsResponse,
  TransactionList,
} from "@/types/api";

export interface SpendingParams {
  from: string;
  to: string;
  type: "EXPENSE" | "INCOME";
  groupBy?: "category" | "day" | "tag";
}

export function fetchSpending({ from, to, type, groupBy }: SpendingParams): Promise<StatsResponse> {
  return readSpending({ from, to, type, groupBy });
}

export function fetchHomeAccounts(): Promise<AccountList> {
  return readAccounts({ limit: 100 });
}

export function fetchHomeBudgets(reference: string): Promise<BudgetList> {
  return readBudgetsPage({ reference, limit: 100 });
}

export function fetchHomeCategories(): Promise<CategoryList> {
  return readCategoriesPage({ includeArchived: true, limit: 100 });
}

export function fetchHomePending(): Promise<TransactionList> {
  return readTransactions({ pendingDetails: true, limit: 1, includeSummary: true });
}
