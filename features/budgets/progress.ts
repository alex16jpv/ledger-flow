import type { Budget } from "@/types/api";

export const BUDGET_PERIOD_TYPES = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "CUSTOM",
] as const satisfies readonly Budget["periodType"][];

export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];

export type BudgetStatusKind = "over" | "fast" | "untouched" | "ended" | "ok";

export interface BudgetProgress {
  ratio: number;
  remaining: number;
  elapsed: number;
  daysLeft: number;
  perDay: number | null;
  status: BudgetStatusKind;
}

const DAY_MS = 86_400_000;

// Money comes from the API (spent, amount); this only compares the two and places them in the period's timeline.
export function budgetProgress(
  budget: Pick<Budget, "spent" | "amount" | "periodFrom" | "periodTo" | "periodType" | "expired">,
  now: Date,
): BudgetProgress {
  const from = new Date(budget.periodFrom).getTime();
  const to = new Date(budget.periodTo).getTime();
  const ratio = budget.amount > 0 ? budget.spent / budget.amount : budget.spent > 0 ? Infinity : 0;
  const remaining = budget.amount - budget.spent;
  const elapsed = to > from ? Math.min(1, Math.max(0, (now.getTime() - from) / (to - from))) : 1;
  const daysLeft = Math.max(0, Math.ceil((to - now.getTime()) / DAY_MS));
  const ended = now.getTime() >= to;
  const perDay = !ended && daysLeft > 0 && remaining > 0 ? remaining / daysLeft : null;
  const status: BudgetStatusKind =
    ratio > 1
      ? "over"
      : ended || (budget.periodType === "CUSTOM" && budget.expired)
        ? "ended"
        : budget.spent === 0
          ? "untouched"
          : ratio >= 0.8
            ? "fast"
            : "ok";
  return { ratio, remaining, elapsed, daysLeft, perDay, status };
}

export function isGlobalBudget(budget: Pick<Budget, "categoryIds">): boolean {
  return budget.categoryIds.length === 0;
}
