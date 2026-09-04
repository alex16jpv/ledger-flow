import { api } from "@/lib/api/client";
import {
  readAccounts,
  readBudgetsPage,
  readCategoriesPage,
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

// Still the server: the buckets and the month's total are money derived over a time zone, which is
// O-F3. Until then the mirror cannot answer Home, so QUERY_DOMAINS.home stays paused while offline.
export function fetchSpending({ from, to, type, groupBy }: SpendingParams): Promise<StatsResponse> {
  return api<StatsResponse>("/stats/spending", { query: { from, to, type, groupBy } });
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
