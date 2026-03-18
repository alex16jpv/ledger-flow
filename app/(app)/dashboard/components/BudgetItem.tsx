import { Budget } from "@/types/Budget.type";
import { BUDGET_COLOR_CLASSES } from "@/utils/constants";
import { formatAmount, percentMinMax } from "@/utils/utils";

export default function BudgetItem({ budget }: { budget: Budget }) {
  const progress = percentMinMax((budget.spent / budget.amount) * 100);
  const isOverBudget = budget.spent > budget.amount;
  const progressColorClass = isOverBudget
    ? "bg-red-400"
    : BUDGET_COLOR_CLASSES[budget.color];
  const textColor = isOverBudget ? "text-red-400" : "text-stone-400";
  const formattedSpent = formatAmount({ amount: budget.spent });
  const formattedAmount = formatAmount({ amount: budget.amount });

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-medium text-stone-800">
          {budget.emoji} {budget.name}
        </span>
        <span className={`font-mono text-xs ${textColor}`}>
          {`${formattedSpent} / ${formattedAmount}`}
        </span>
      </div>
      <div className="progress-track">
        <div
          className={`h-full rounded-full ${progressColorClass}`}
          style={{
            width: `${progress}%`,
          }}
        ></div>
      </div>
    </div>
  );
}
