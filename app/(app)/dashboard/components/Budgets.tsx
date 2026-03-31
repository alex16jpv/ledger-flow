import Link from "next/link";
import BudgetItem from "./BudgetItem";
import { MOCK_BUDGETS } from "@/lib/mock/budgets.mock";
import { MOCK_CATEGORIES } from "@/lib/mock/categories.mock";

export default function Budgets() {
  const categoryMap = new Map(MOCK_CATEGORIES.map((c) => [c.id, c]));
  return (
    <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h2 className="text-sm font-medium text-stone-800">Monthly Budgets</h2>
        <Link
          href="/budgets"
          className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
        >
          Manage →
        </Link>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {MOCK_BUDGETS.map((budget) => (
          <BudgetItem
            key={budget.id}
            budget={budget}
            categoryEmoji={categoryMap.get(budget.categoryId)?.emoji}
          />
        ))}
      </div>

      {/* <!-- Insight alert --> */}
      {/* <div className="mx-4 mb-4 bg-purple-50 border border-purple-200 rounded-xl p-3.5 flex gap-2.5 items-start">
        <span className="text-base shrink-0 mt-0.5">✦</span>
        <div>
          <p className="text-xs font-medium text-purple-800 mb-0.5">
            Entertainment exceeded
          </p>
          <p className="text-xs text-purple-600 leading-relaxed">
            $400 over the limit. 17 days left in the month.
          </p>
        </div>
      </div> */}
    </div>
  );
}
