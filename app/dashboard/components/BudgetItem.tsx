import { BudgetType } from "@/types/Budget.type";

export default function BudgetItem({ budget }: { budget: BudgetType }) {
  const progress = Math.min(
    100,
    Math.max(0, (budget.spent / budget.amount) * 100),
  );

  const isOverBudget = budget.spent > budget.amount;
  const progressColor = isOverBudget ? "red-400" : budget.color;
  const textColor = isOverBudget ? "text-red-400" : "text-stone-400";

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-medium text-stone-800">
          {budget.emoji} {budget.name}
        </span>
        <span className={`font-mono text-xs ${textColor}`}>
          ${budget.spent} / ${budget.amount}
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
