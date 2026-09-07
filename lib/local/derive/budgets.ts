import type { SyncBudget, SyncTransaction } from "@/types/api";

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
  "type" | "amount" | "date" | "categoryId" | "deletedAt"
>;

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

// Everything the API's budget view adds to the stored row. Archiving is not part of it: the detail
// endpoint answers for an archived budget too, and it is the list that leaves it out.
export function deriveBudgetView(
  budget: BudgetRow,
  transactions: BudgetTransaction[],
  archivedCategoryIds: ReadonlySet<string>,
  reference: Date,
  timeZone: string,
): DerivedBudgetView {
  const period = resolvePeriod(budget, reference, timeZone);
  const from = period.from.getTime();
  const to = period.to.getTime();

  const spentCents = transactions.reduce((cents, transaction) => {
    if (transaction.deletedAt) return cents;
    // The budget's own type filters the rows: an INCOME budget ignores every expense in its window.
    if (transaction.type !== budget.type) return cents;
    const at = Date.parse(transaction.date);
    if (at < from || at >= to) return cents;
    // No categories means global: the window's whole spend of that type, quick-adds and
    // uncategorized rows included. With categories it sums only those.
    if (
      budget.categoryIds.length > 0 &&
      (transaction.categoryId === null || !budget.categoryIds.includes(transaction.categoryId))
    ) {
      return cents;
    }
    return cents + toCents(transaction.amount);
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
    expired:
      budget.periodType === "CUSTOM" &&
      budget.periodEndDate !== null &&
      reference.getTime() >= Date.parse(budget.periodEndDate),
    archivedCategoryIds: budget.categoryIds.filter((id) => archivedCategoryIds.has(id)),
  };
}

// A budget does not exist before this instant, and the list drops any period that closes on or
// before it. A CUSTOM window is explicit, so a budget backdated before its own creation still lists.
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
