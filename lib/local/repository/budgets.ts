import type { IDBPDatabase } from "idb";

import { api } from "@/lib/api/client";
import type { Budget, BudgetList, SyncBudget } from "@/types/api";

import {
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

interface ViewContext {
  reference: Date;
  timeZone: string;
  archivedCategoryIds: Set<string>;
  rows: Map<string, BudgetTransaction[]>;
}

const windowKey = (period: ResolvedPeriod): string =>
  `${period.from.getTime()}_${period.to.getTime()}`;

// One walk of the index per distinct window, the way the server runs one aggregation for the
// budgets that share one. Undefined means the mirror cannot answer, and the read goes to the server.
async function viewContext(
  db: IDBPDatabase<VaultSchema>,
  budgets: SyncBudget[],
  reference: Date,
): Promise<ViewContext | undefined> {
  const timeZone = await mirrorTimeZone(db);
  if (timeZone === undefined) return undefined;

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

// SyncBudget plus everything the API adds on top: the period's own fields, `archivedCategoryIds`
// from the categories mirror, and `effectiveFrom`, which the API answers as the lifetime floor.
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

// A budget does not exist before its lifetime floor, and an expired CUSTOM one-shot leaves the
// default listing while the recurring types roll forward. Both run after pagination, as on the
// server, which is why a page's `total` counts rows these still drop.
function listed(view: Budget, budget: SyncBudget, params: BudgetListParams): boolean {
  if (Date.parse(view.periodTo) <= lifetimeFloor(budget).getTime()) return false;
  return Boolean(params.includeExpired) || !view.expired;
}

// Sorted by id, which is the `_id` ascending the endpoint pages by and IndexedDB's own key order.
async function storedBudgets(
  db: IDBPDatabase<VaultSchema>,
  params: BudgetListParams,
): Promise<SyncBudget[]> {
  const records = await db.getAll("budgets");
  return records
    .filter((record) => params.includeArchived === true || record.archived === 0)
    .map((record) => record.row);
}

function referenceOf(reference: string | undefined): Date {
  return reference ? new Date(reference) : new Date();
}

function viewsOf(budgets: SyncBudget[], context: ViewContext, params: BudgetListParams): Budget[] {
  return budgets
    .map((budget) => ({ budget, view: toView(budget, context) }))
    .filter(({ budget, view }) => listed(view, budget, params))
    .map(({ view }) => view);
}

export function readBudgets(params: BudgetListParams = {}): Promise<Budget[]> {
  return read<Budget[]>(
    () => drain(params),
    async (db) => {
      const budgets = await storedBudgets(db, params);
      const context = await viewContext(db, budgets, referenceOf(params.reference));
      return context && viewsOf(budgets, context, params);
    },
  );
}

export function readBudgetsPage(params: BudgetListParams = {}): Promise<BudgetList> {
  return read<BudgetList>(
    () => api<BudgetList>("/budgets", { query: listQuery(params) }),
    async (db) => {
      // The envelope counts and pages the stored rows; the view filters only thin `data` after.
      const { data: paged, pagination } = mirrorPage(
        await storedBudgets(db, params),
        params.limit ?? BUDGET_PAGE_LIMIT,
      );
      const context = await viewContext(db, paged, referenceOf(params.reference));
      return context && { data: viewsOf(paged, context, params), pagination };
    },
  );
}

export function readBudget(id: string, reference?: string): Promise<Budget> {
  return read<Budget>(
    () => api<Budget>(`/budgets/${id}`, { query: { reference } }),
    async (db) => {
      const record = await db.get("budgets", id);
      // The detail endpoint answers for an archived budget too; only the list leaves it out.
      if (!record) return undefined;
      const context = await viewContext(db, [record.row], referenceOf(reference));
      return context && toView(record.row, context);
    },
  );
}
