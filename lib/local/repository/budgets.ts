import { api } from "@/lib/api/client";
import type { Budget, BudgetList } from "@/types/api";

import { read } from "./read";

export const BUDGET_PAGE_LIMIT = 100;

export interface BudgetListParams {
  reference?: string;
  includeExpired?: boolean;
  includeArchived?: boolean;
  limit?: number;
}

// The mirror holds SyncBudget, the saved shape, while the API answers the view. Every field of that
// view is derivable here except `spent`, which every budget surface reads, so the whole read is
// declined until lib/local/derive lands (O-F3) rather than served with a figure nobody computed.
const withoutDerivedSpent = (): Promise<undefined> => Promise.resolve(undefined);

function listQuery(params: BudgetListParams, cursor?: string) {
  return {
    reference: params.reference,
    includeExpired: params.includeExpired ? "true" : undefined,
    includeArchived: params.includeArchived ? "true" : undefined,
    limit: params.limit ?? BUDGET_PAGE_LIMIT,
    cursor,
  };
}

// The expired and lifetime filters run after pagination on the server, so hasMore must be followed
// even for short pages.
async function drain(params: BudgetListParams): Promise<Budget[]> {
  const data: Budget[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<BudgetList>("/budgets", { query: listQuery(params, cursor) });
    data.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return data;
}

export function readBudgets(params: BudgetListParams = {}): Promise<Budget[]> {
  return read<Budget[]>(() => drain(params), withoutDerivedSpent);
}

export function readBudgetsPage(params: BudgetListParams = {}): Promise<BudgetList> {
  return read<BudgetList>(
    () => api<BudgetList>("/budgets", { query: listQuery(params) }),
    withoutDerivedSpent,
  );
}

export function readBudget(id: string, reference?: string): Promise<Budget> {
  return read<Budget>(
    () => api<Budget>(`/budgets/${id}`, { query: { reference } }),
    withoutDerivedSpent,
  );
}
