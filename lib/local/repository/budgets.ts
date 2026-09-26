import type { IDBPDatabase } from "idb";

import { api } from "@/lib/api/client";
import type { Budget, BudgetList, SyncBudget } from "@/types/api";

import {
  budgetExpired,
  type BudgetTransaction,
  deriveBudgetView,
  lifetimeFloor,
  type ResolvedPeriod,
  resolvePeriod,
} from "../derive";
import type { VaultSchema } from "../schema";
import { mirrorPage, read } from "./read";
import { liveRowsInWindow, mirrorTimeZone } from "./window";

export const BUDGET_PAGE_LIMIT = 100;

export interface BudgetListParams {
  reference?: string;
  includeExpired?: boolean;
  includeArchived?: boolean;
  limit?: number;
}

function listQuery(params: BudgetListParams, cursor?: string) {
  return {
    reference: params.reference,
    includeExpired: params.includeExpired ? "true" : undefined,
    includeArchived: params.includeArchived ? "true" : undefined,
    limit: params.limit ?? BUDGET_PAGE_LIMIT,
    cursor,
  };
}

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

interface ViewContext {
  reference: Date;
  timeZone: string;
  archivedCategoryIds: Set<string>;
  rows: Map<string, BudgetTransaction[]>;
}

const windowKey = (period: ResolvedPeriod): string =>
  `${period.from.getTime()}_${period.to.getTime()}`;

async function viewContext(
  db: IDBPDatabase<VaultSchema>,
  budgets: SyncBudget[],
  reference: Date,
  timeZone: string,
): Promise<ViewContext> {
  const archivedCategoryIds = new Set<string>();
  for (const record of await db.getAll("categories")) {
    if (record.archived === 1) archivedCategoryIds.add(record.id);
  }

  const rows = new Map<string, BudgetTransaction[]>();
  for (const budget of budgets) {
    const period = resolvePeriod(budget, reference, timeZone);
    const key = windowKey(period);
    if (!rows.has(key)) {
      rows.set(key, await liveRowsInWindow(db, period.from.toISOString(), period.to.toISOString()));
    }
  }

  return { reference, timeZone, archivedCategoryIds, rows };
}

// Plus the period's fields, `archivedCategoryIds`, and `effectiveFrom` as the lifetime floor.
function toView(budget: SyncBudget, context: ViewContext): Budget {
  const period = resolvePeriod(budget, context.reference, context.timeZone);
  const view = deriveBudgetView(
    budget,
    context.rows.get(windowKey(period)) ?? [],
    context.archivedCategoryIds,
    context.reference,
    context.timeZone,
  );
  return {
    id: budget.id,
    name: budget.name,
    color: budget.color,
    categoryIds: budget.categoryIds,
    archivedCategoryIds: view.archivedCategoryIds,
    type: budget.type,
    currency: budget.currency,
    periodType: budget.periodType,
    periodKey: view.periodKey,
    periodFrom: view.periodFrom.toISOString(),
    periodTo: view.periodTo.toISOString(),
    baseAmount: view.baseAmount,
    amount: view.amount,
    spent: view.spent,
    hasOverride: view.hasOverride,
    expired: view.expired,
    effectiveFrom: lifetimeFloor(budget).toISOString(),
    note: budget.note,
    archivedAt: budget.archivedAt,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

function listed(
  budget: SyncBudget,
  reference: Date,
  timeZone: string,
  params: BudgetListParams,
): boolean {
  const period = resolvePeriod(budget, reference, timeZone);
  if (period.to.getTime() <= lifetimeFloor(budget).getTime()) return false;
  return Boolean(params.includeExpired) || !budgetExpired(budget, reference);
}

interface Listing {
  budgets: SyncBudget[];
  timeZone: string;
}

// Judged before any paging, as the server's query does. Sorted by id, the `_id` order it pages by.
async function listing(
  db: IDBPDatabase<VaultSchema>,
  params: BudgetListParams,
  reference: Date,
): Promise<Listing | undefined> {
  const timeZone = await mirrorTimeZone(db);
  if (timeZone === undefined) return undefined;
  const records = await db.getAll("budgets");
  const budgets = records
    .filter((record) => params.includeArchived === true || record.archived === 0)
    .map((record) => record.row)
    .filter((budget) => listed(budget, reference, timeZone, params));
  return { budgets, timeZone };
}

function referenceOf(reference: string | undefined): Date {
  return reference ? new Date(reference) : new Date();
}

async function viewsOf(
  db: IDBPDatabase<VaultSchema>,
  budgets: SyncBudget[],
  reference: Date,
  timeZone: string,
): Promise<Budget[]> {
  const context = await viewContext(db, budgets, reference, timeZone);
  return budgets.map((budget) => toView(budget, context));
}

export function readBudgets(params: BudgetListParams = {}): Promise<Budget[]> {
  return read<Budget[]>(
    () => drain(params),
    async (db) => {
      const reference = referenceOf(params.reference);
      const found = await listing(db, params, reference);
      return found && viewsOf(db, found.budgets, reference, found.timeZone);
    },
  );
}

export function readBudgetsPage(params: BudgetListParams = {}): Promise<BudgetList> {
  return read<BudgetList>(
    () => api<BudgetList>("/budgets", { query: listQuery(params) }),
    async (db) => {
      const reference = referenceOf(params.reference);
      const found = await listing(db, params, reference);
      if (!found) return undefined;
      const { data, pagination } = mirrorPage(found.budgets, params.limit ?? BUDGET_PAGE_LIMIT);
      return { data: await viewsOf(db, data, reference, found.timeZone), pagination };
    },
  );
}

// O-F4: the mirror alone, which is what a queued write answers with while its operation waits.
export async function mirrorBudget(
  db: IDBPDatabase<VaultSchema>,
  id: string,
  reference?: string,
): Promise<Budget | undefined> {
  const record = await db.get("budgets", id);
  // The detail endpoint answers for an archived budget too; only the list leaves it out.
  if (!record) return undefined;
  const timeZone = await mirrorTimeZone(db);
  if (timeZone === undefined) return undefined;
  const [view] = await viewsOf(db, [record.row], referenceOf(reference), timeZone);
  return view;
}

export function readBudget(id: string, reference?: string): Promise<Budget> {
  return read<Budget>(
    () => api<Budget>(`/budgets/${id}`, { query: { reference } }),
    (db) => mirrorBudget(db, id, reference),
  );
}
