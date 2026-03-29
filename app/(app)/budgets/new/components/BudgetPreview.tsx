import { BudgetColor } from "@/types/Budget.type";
import { BUDGET_COLOR_CLASSES } from "@/utils/constants";
import { formatAmount } from "@/utils/utils";
import Link from "next/link";

export function SaveButton() {
  return (
    <button
      type="submit"
      className="w-full bg-teal-400 hover:bg-teal-600 text-white font-medium text-sm rounded-xl py-3 transition-colors"
    >
      Create Budget
    </button>
  );
}

export default function BudgetPreview({
  name,
  emoji,
  color,
  category,
  amount,
}: {
  name: string;
  emoji: string;
  color: BudgetColor;
  category: string;
  amount: number;
}) {
  const colorClass = BUDGET_COLOR_CLASSES[color];
  const displayName = name || "Budget Name";
  const displayEmoji = emoji || "◎";
  const displayCategory = category || "Uncategorized";
  const displayAmount = amount > 0 ? formatAmount({ amount }) : "$0";

  return (
    <div className="lg:col-span-2 flex flex-col gap-5">
      <div className="sticky top-24 flex flex-col gap-4">
        {/* Preview card */}
        <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-medium text-stone-800">Preview</p>
          </div>

          <div className="p-5">
            {/* Header preview */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-2xl">
                {displayEmoji}
              </div>
              <div>
                <p className="text-base font-medium text-stone-800">
                  {displayName}
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
                $0 / <strong className="text-stone-800">{displayAmount}</strong>
              </span>
            </div>

            {/* Progress bar */}
            <div className="progress-track mb-3">
              <div
                className={`h-full rounded-full ${colorClass}`}
                style={{ width: "0%" }}
              />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="bg-teal-50 border border-teal-100 text-teal-600 font-mono text-xs px-2.5 py-1 rounded-full">
                {displayAmount} available
              </span>
              <span className="font-mono text-[10px] text-stone-400">
                0% used
              </span>
            </div>
          </div>
        </div>

        {/* Linked category info */}
        <div className="bg-white border border-stone-100 rounded-xl p-5">
          <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-3">
            Linked Category
          </p>
          <p className="font-mono text-xs text-stone-400 mb-3">
            Expense transactions with the category{" "}
            <strong className="text-stone-600">{displayCategory}</strong> will
            be automatically attributed to this budget.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xl">{displayEmoji}</span>
            <span className="bg-teal-50 border border-teal-100 text-teal-800 font-mono text-xs px-2.5 py-1 rounded-full">
              {displayCategory}
            </span>
          </div>
        </div>

        {/* Actions */}
        <SaveButton />

        <Link
          href="/budgets"
          className="text-center text-stone-400 hover:text-stone-600 font-mono text-xs py-1 transition-colors block"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
