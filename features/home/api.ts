import { api } from "@/lib/api/client";
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
  return api<StatsResponse>("/stats/spending", { query: { from, to, type, groupBy } });
}

export function fetchHomeAccounts(): Promise<AccountList> {
  return api<AccountList>("/accounts", { query: { limit: 100 } });
}

export function fetchHomeBudgets(reference: string): Promise<BudgetList> {
  return api<BudgetList>("/budgets", { query: { reference, limit: 100 } });
}

export function fetchHomeCategories(): Promise<CategoryList> {
  return api<CategoryList>("/categories", { query: { includeArchived: "true", limit: 100 } });
}

export function fetchHomePending(): Promise<TransactionList> {
  return api<TransactionList>("/transactions", {
    query: { pendingDetails: true, limit: 1, includeSummary: true },
  });
}
