import { Budget } from "@/types/Budget.types";
import { formatAmount } from "@/utils/utils";
import { getBudgetStatus } from "@/utils/budget.utils";

export default function BudgetItem({
  budget,
  categoryEmoji,
}: {
  budget: Budget;
  categoryEmoji?: string;
}) {
  const status = getBudgetStatus(budget);
  const emoji = categoryEmoji ?? "📦";
  const textColor = status.isOver ? "text-red-400" : "text-stone-400";
  const formattedSpent = formatAmount({ amount: budget.spent });
  const formattedAmount = formatAmount({ amount: budget.amount });

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-medium text-stone-800">
          {emoji} {budget.name}
        </span>
        <span className={`font-mono text-xs ${textColor}`}>
          {`${formattedSpent} / ${formattedAmount}`}
        </span>
      </div>
      <div className="progress-track">
        <div
          className={`h-full rounded-full ${status.progressColor}`}
          style={{
            width: `${status.progress}%`,
          }}
        ></div>
      </div>
    </div>
  );
}
