import { Budget } from "@/types/Budget.type";
import { BUDGET_COLOR_CLASSES } from "@/utils/constants";
import { formatAmount, percentMinMax } from "@/utils/utils";

export type BudgetStatusLabel = "Exceeded" | "Almost depleted" | "On track";

export type BudgetStatus = {
  percent: number;
  progress: number;
  isOver: boolean;
  remaining: number;
  label: BudgetStatusLabel;
  badgeBg: string;
  badgeText: string;
  progressColor: string;
  remainingColor: string;
  remainingText: string;
};

export function getBudgetStatus(budget: Budget): BudgetStatus {
  const percent = Math.round((budget.spent / budget.amount) * 100);
  const progress = percentMinMax((budget.spent / budget.amount) * 100);
  const isOver = budget.spent > budget.amount;
  const remaining = budget.amount - budget.spent;

  if (isOver) {
    return {
      percent,
      progress,
      isOver,
      remaining,
      label: "Exceeded",
      badgeBg: "bg-red-50",
      badgeText: "text-red-600",
      progressColor: "bg-red-400",
      remainingColor: "text-red-600",
      remainingText: `${formatAmount({ amount: Math.abs(remaining) })} over limit`,
    };
  }

  if (percent >= 80) {
    return {
      percent,
      progress,
      isOver,
      remaining,
      label: "Almost depleted",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-600",
      progressColor: BUDGET_COLOR_CLASSES[budget.color],
      remainingColor: "text-stone-400",
      remainingText: `${formatAmount({ amount: remaining })} remaining`,
    };
  }

  return {
    percent,
    progress,
    isOver,
    remaining,
    label: "On track",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-600",
    progressColor: BUDGET_COLOR_CLASSES[budget.color],
    remainingColor: "text-stone-400",
    remainingText: `${formatAmount({ amount: remaining })} remaining`,
  };
}
