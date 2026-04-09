import { Budget } from "@/types/Budget.types";
import { formatAmount } from "@/utils/utils";

export default function BudgetSummary({ budgets }: { budgets: Budget[] }) {
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const available = totalBudget - totalSpent;
  const spentPercent =
    totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const categoriesWithBudget = budgets.filter(
    (budget) => budget.amount - budget.spent > 0,
  ).length;

  return (
    <section aria-label="Budget summary" className="grid grid-cols-3 gap-4">
      <div className="bg-white border border-stone-100 rounded-xl p-5">
        <p className="font-mono text-xs text-stone-400 uppercase tracking-widest mb-2">
          Total Budget
        </p>
        <p className="font-display text-3xl font-medium text-stone-800 leading-none mb-2">
          {formatAmount({ amount: totalBudget })}
        </p>
        <p className="font-mono text-xs text-stone-400">
          {budgets.length} categor{budgets.length !== 1 ? "ies" : "y"}
        </p>
      </div>

      <div className="bg-white border border-stone-100 rounded-xl p-5">
        <p className="font-mono text-xs text-stone-400 uppercase tracking-widest mb-2">
          Spent to Date
        </p>
        <p className="font-display text-3xl font-medium text-amber-600 leading-none mb-2">
          {formatAmount({ amount: totalSpent })}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${Math.min(spentPercent, 100)}%` }}
            />
          </div>
          <span className="font-mono text-xs text-stone-400">
            {spentPercent}%
          </span>
        </div>
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
        <p className="font-mono text-xs text-teal-600 uppercase tracking-widest mb-2">
          Available
        </p>
        <p className="font-display text-3xl font-medium text-teal-800 leading-none mb-2">
          {formatAmount({ amount: Math.max(available, 0) })}
        </p>
        <p className="font-mono text-xs text-teal-600">
          in {categoriesWithBudget} categor
          {categoriesWithBudget !== 1 ? "ies" : "y"}
        </p>
      </div>
    </section>
  );
}
