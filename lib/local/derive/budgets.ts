import type { SyncBudget, SyncTransaction } from "@/types/api";

import { dayWindow, withinDays } from "./days";
import { fromCents, toCents } from "./money";
import { resolvePeriod } from "./period";

export type BudgetRow = Pick<
  SyncBudget,
  | "categoryIds"
  | "type"
  | "amount"
  | "amountOverrides"
  | "periodType"
  | "periodStartDate"
  | "periodEndDate"
>;

export type BudgetTransaction = Pick<
  SyncTransaction,
  "type" | "amount" | "date" | "dayKey" | "categoryId" | "deletedAt"
> &
  // Absent on a row written before splitting existed, and then the whole amount is yours.
  Partial<Pick<SyncTransaction, "countsAsYours">>;

export interface DerivedBudgetView {
  periodKey: string;
  periodFrom: Date;
  periodTo: Date;
  baseAmount: number;
  amount: number;
  hasOverride: boolean;
  spent: number;
  expired: boolean;
  archivedCategoryIds: string[];
}

// Archiving is not part of it: the detail endpoint answers for an archived budget too.
export function deriveBudgetView(
  budget: BudgetRow,
  transactions: BudgetTransaction[],
  archivedCategoryIds: ReadonlySet<string>,
  reference: Date,
  timeZone: string,
): DerivedBudgetView {
  const period = resolvePeriod(budget, reference, timeZone);
  const days = dayWindow(period.from.toISOString(), period.to.toISOString(), timeZone);

  const spentCents = transactions.reduce((cents, transaction) => {
    if (transaction.deletedAt) return cents;
    // The budget's own type filters the rows: an INCOME budget ignores every expense in its window.
    if (transaction.type !== budget.type) return cents;
    if (!withinDays(transaction, days)) return cents;
    // No categories means global: the window's whole spend of that type, uncategorized included.
    if (
      budget.categoryIds.length > 0 &&
      (transaction.categoryId === null || !budget.categoryIds.includes(transaction.categoryId))
    ) {
      return cents;
    }
    // What a budget measures is what is left as yours: every payment lowers it in the expense's month.
    return cents + toCents(transaction.countsAsYours ?? transaction.amount);
  }, 0);

  const override = budget.amountOverrides[period.key];

  return {
    periodKey: period.key,
    periodFrom: period.from,
    periodTo: period.to,
    baseAmount: budget.amount,
    amount: override ?? budget.amount,
    hasOverride: override !== undefined,
    spent: fromCents(spentCents),
    expired: budgetExpired(budget, reference),
    archivedCategoryIds: budget.categoryIds.filter((id) => archivedCategoryIds.has(id)),
  };
}

export function budgetExpired(
  budget: Pick<BudgetRow, "periodType" | "periodEndDate">,
  reference: Date,
): boolean {
  return (
    budget.periodType === "CUSTOM" &&
    budget.periodEndDate !== null &&
    reference.getTime() >= Date.parse(budget.periodEndDate)
  );
}

// A CUSTOM window is explicit, so a budget backdated before its own creation still lists.
export function lifetimeFloor(
  budget: Pick<SyncBudget, "effectiveFrom" | "createdAt" | "periodType" | "periodStartDate">,
): Date {
  const floor = new Date(budget.effectiveFrom ?? budget.createdAt);
  if (budget.periodType === "CUSTOM" && budget.periodStartDate) {
    const start = new Date(budget.periodStartDate);
    if (start.getTime() < floor.getTime()) return start;
  }
  return floor;
}
