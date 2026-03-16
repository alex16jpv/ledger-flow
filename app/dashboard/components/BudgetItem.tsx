import { BudgetType } from "@/types/Budget.type";
import { formatAmount, percentMinMax } from "@/utils/utils";

export default function BudgetItem({ budget }: { budget: BudgetType }) {
  const progress = percentMinMax((budget.spent / budget.amount) * 100);
  const isOverBudget = budget.spent > budget.amount;
  const progressColor = isOverBudget ? "red-400" : budget.color;
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
          className={`h-full rounded-full bg-${progressColor}`}
          style={{
            width: `${progress}%`,
          }}
        ></div>
      </div>
    </div>
  );
}
