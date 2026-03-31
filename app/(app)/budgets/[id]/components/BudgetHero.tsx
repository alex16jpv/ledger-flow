import { Budget } from "@/types/Budget.type";
import { formatAmount } from "@/utils/utils";
import { getBudgetStatus } from "@/utils/budget.utils";

export default function BudgetHero({
  budget,
  categoryEmoji,
}: {
  budget: Budget;
  categoryEmoji?: string;
}) {
  const status = getBudgetStatus(budget);
  const emoji = categoryEmoji ?? "📦";

  const statusBadge = status.isOver
    ? { bg: "bg-red-50 border-red-200", text: "text-red-600" }
    : status.percent >= 80
      ? { bg: "bg-amber-50 border-amber-200", text: "text-amber-600" }
      : { bg: "bg-teal-50 border-teal-100", text: "text-teal-600" };

  return (
    <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-2xl">
            {emoji}
          </div>
          <div>
            <p className="text-base font-medium text-stone-800">
              {budget.name}
            </p>
            <p className="font-mono text-xs text-stone-400 mt-0.5">
              Monthly budget
            </p>
          </div>
        </div>

        {/* Amount display */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-mono text-xs text-stone-400">
            Spent this month
          </span>
          <span className="font-mono text-sm text-stone-500">
            {formatAmount({ amount: budget.spent })} /{" "}
            <strong className="text-stone-800">
              {formatAmount({ amount: budget.amount })}
            </strong>
          </span>
        </div>

        {/* Progress bar */}
        <div className="progress-track mb-3">
          <div
            className={`h-full rounded-full ${status.progressColor}`}
            style={{ width: `${status.progress}%` }}
          />
        </div>

        {/* Status */}
        <div className="flex items-center justify-between">
          <span
            className={`${statusBadge.bg} ${statusBadge.text} border font-mono text-xs px-2.5 py-1 rounded-full`}
          >
            {status.remainingText}
          </span>
          <span className="font-mono text-[10px] text-stone-400">
            {status.percent}% used
          </span>
        </div>
      </div>
    </div>
  );
}
