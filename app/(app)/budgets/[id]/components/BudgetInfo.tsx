import { Budget } from "@/types/Budget.type";
import { BUDGET_COLOR_CLASSES } from "@/utils/constants";
import { formatAmount } from "@/utils/utils";

export default function BudgetInfo({ budget }: { budget: Budget }) {
  const colorClass = BUDGET_COLOR_CLASSES[budget.color];
  const remaining = budget.amount - budget.spent;
  const isOver = remaining < 0;

  const rows = [
    { label: "Category", value: budget.category },
    { label: "Name", value: budget.name },
    { label: "Emoji", value: budget.emoji },
    { label: "Limit", value: formatAmount({ amount: budget.amount }) },
    { label: "Spent", value: formatAmount({ amount: budget.spent }) },
    {
      label: isOver ? "Exceeded by" : "Remaining",
      value: formatAmount({ amount: Math.abs(remaining) }),
      highlight: isOver ? "text-red-600" : undefined,
    },
  ];

  return (
    <div className="bg-white border border-stone-100 rounded-xl p-5">
      <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-4">
        Budget Information
      </p>
      <dl className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={row.label}>
            <div className="flex justify-between items-start">
              <dt className="font-mono text-xs text-stone-400">{row.label}</dt>
              <dd
                className={`text-sm text-right ${row.highlight ?? "text-stone-700"}`}
              >
                {row.value}
              </dd>
            </div>
            {i < rows.length - 1 && <div className="h-px bg-stone-50 mt-3" />}
          </div>
        ))}
      </dl>

      {/* Color indicator */}
      <div className="mt-4 pt-3 border-t border-stone-50 flex items-center gap-2">
        <span className="font-mono text-xs text-stone-400">Color</span>
        <div className={`w-4 h-4 rounded-full ${colorClass}`} />
      </div>
    </div>
  );
}
