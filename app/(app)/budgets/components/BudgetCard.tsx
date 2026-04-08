import Link from "next/link";
import { Budget } from "@/types/Budget.types";
import { formatAmount } from "@/utils/utils";
import { getBudgetStatus } from "@/utils/budget.utils";
import { BUDGET_WARNING_THRESHOLD_PERCENT } from "@/utils/constants";

export default function BudgetCard({
  budget,
  categoryEmoji,
}: {
  budget: Budget;
  categoryEmoji?: string;
}) {
  const status = getBudgetStatus(budget);
  const formattedSpent = formatAmount({ amount: budget.spent });
  const formattedLimit = formatAmount({ amount: budget.amount });
  const emoji = categoryEmoji ?? "📦";

  const cardBg = status.isOver
    ? "bg-red-50 border-red-200"
    : "bg-white border-stone-100 hover:border-stone-200";

  return (
    <Link href={`/budgets/${budget.id}`} className="block">
      <article
        className={`${cardBg} border rounded-xl p-5 transition-colors h-full`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{emoji}</span>
            <div>
              <p className="text-sm font-medium text-stone-800">
                {budget.name}
              </p>
              <p
                className={`font-mono text-[10px] mt-0.5 ${status.isOver ? "text-red-600" : "text-stone-400"}`}
              >
                {formattedSpent} spent
              </p>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className={`font-mono text-xs ${status.remainingColor}`}>
              {status.remainingText}
            </span>
            <span
              className={`font-mono text-xs font-medium ${status.isOver ? "text-red-600" : status.percent >= BUDGET_WARNING_THRESHOLD_PERCENT ? "text-amber-600" : "text-teal-600"}`}
            >
              {status.percent}%
            </span>
          </div>
          <div className="progress-track">
            <div
              className={`h-full rounded-full ${status.progressColor}`}
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="font-mono text-xs text-stone-400">
            Limit {formattedLimit}
          </span>
          <span
            className={`${status.badgeBg} ${status.badgeText} font-mono text-[10px] px-2 py-0.5 rounded-full`}
          >
            {status.label}
          </span>
        </div>
      </article>
    </Link>
  );
}
