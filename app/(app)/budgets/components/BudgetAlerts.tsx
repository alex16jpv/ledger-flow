import { Budget } from "@/types/Budget.type";
import { formatAmount } from "@/utils/utils";
import Link from "next/link";

function getAlerts(
  budgets: Budget[],
): {
  icon: string;
  title: string;
  description: string;
  type: "danger" | "warning";
}[] {
  const alerts: {
    icon: string;
    title: string;
    description: string;
    type: "danger" | "warning";
  }[] = [];

  for (const b of budgets) {
    const percent = Math.round((b.spent / b.amount) * 100);

    if (b.spent > b.amount) {
      const over = formatAmount({ amount: b.spent - b.amount });
      alerts.push({
        icon: "⚠",
        title: `${b.name} exceeded`,
        description: `${over} over the monthly limit.`,
        type: "danger",
      });
    } else if (percent >= 80) {
      const remaining = formatAmount({ amount: b.amount - b.spent });
      alerts.push({
        icon: "✦",
        title: `${b.name} at ${percent}%`,
        description: `${remaining} remaining.`,
        type: "warning",
      });
    }
  }

  return alerts;
}

export default function BudgetAlerts({ budgets }: { budgets: Budget[] }) {
  const alerts = getAlerts(budgets);

  return (
    <div className="flex flex-col gap-4">
      {/* Alerts panel */}
      <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-medium text-stone-800">Alerts</h2>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {alerts.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-2">
              All budgets are on track
            </p>
          ) : (
            alerts.map((alert, i) => {
              const isDanger = alert.type === "danger";
              return (
                <div
                  key={i}
                  className={`${isDanger ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"} border rounded-xl p-3.5 flex gap-2.5 items-start`}
                >
                  <span className="text-base shrink-0 mt-0.5">
                    {alert.icon}
                  </span>
                  <div>
                    <p
                      className={`text-xs font-medium mb-0.5 ${isDanger ? "text-red-800" : "text-amber-800"}`}
                    >
                      {alert.title}
                    </p>
                    <p
                      className={`text-xs leading-relaxed ${isDanger ? "text-red-600" : "text-amber-600"}`}
                    >
                      {alert.description}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add budget CTA */}
      <Link
        href="/budgets/new"
        className="bg-stone-50 border border-dashed border-stone-200 hover:border-teal-400 hover:bg-teal-50 rounded-xl p-4 flex items-center gap-3 transition-colors group w-full text-left"
      >
        <div className="w-9 h-9 rounded-lg border border-dashed border-stone-200 group-hover:border-teal-400 flex items-center justify-center text-stone-400 group-hover:text-teal-600 transition-colors text-lg shrink-0">
          ＋
        </div>
        <div>
          <p className="text-sm font-medium text-stone-600 group-hover:text-teal-800 transition-colors">
            New Budget
          </p>
          <p className="text-xs text-stone-400 mt-0.5">Add a category</p>
        </div>
      </Link>
    </div>
  );
}
