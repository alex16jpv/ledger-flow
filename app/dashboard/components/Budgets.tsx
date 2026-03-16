import Link from "next/link";
import BudgetItem from "./BudgetItem";
import { BudgetType } from "@/types/Budget.type";

const budgets: BudgetType[] = [
  {
    id: "1",
    name: "Food",
    emoji: "🍔",
    color: "amber-200",
    amount: 5000,
    spent: 4200,
  },
  {
    id: "2",
    name: "Transportation",
    emoji: "🚌",
    color: "teal-400",
    amount: 3000,
    spent: 1100,
  },
  {
    id: "3",
    name: "Entertainment",
    emoji: "🎬",
    color: "red-400",
    amount: 2000,
    spent: 2400,
  },
  {
    id: "4",
    name: "Home",
    emoji: "🏠",
    color: "amber-400",
    amount: 30000,
    spent: 28000,
  },
  {
    id: "5",
    name: "Health",
    emoji: "💊",
    color: "teal-400",
    amount: 2000,
    spent: 680,
  },
];

export default function Budgets() {
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
        {budgets.map((budget) => (
          <BudgetItem key={budget.id} budget={budget} />
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
