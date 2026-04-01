import { Transaction } from "@/types/Transaction.types";
import { TRANSACTION_TYPES } from "@/utils/constants";
import type { Category } from "@/types/Category.types";
import { formatAmount } from "@/utils/utils";
import { getCurrentMonthName } from "@/lib/dates";
import Link from "next/link";

function MonthlySummary({ transactions }: { transactions: Transaction[] }) {
  const totalIncome = transactions
    .filter((transaction) => transaction.type === TRANSACTION_TYPES.INCOME)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = transactions
    .filter((transaction) => transaction.type === TRANSACTION_TYPES.EXPENSE)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const balance = totalIncome - totalExpenses;

  return (
    <div className="bg-white border border-stone-100 rounded-xl p-5">
      <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-4">
        Summary · {getCurrentMonthName()}
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-stone-600">Income</span>
          <span className="font-mono text-sm font-medium text-teal-600">
            +{formatAmount({ amount: totalIncome })}
          </span>
        </div>
        <div className="h-px bg-stone-50"></div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-stone-600">Expenses</span>
          <span className="font-mono text-sm font-medium text-stone-700">
            −{formatAmount({ amount: totalExpenses })}
          </span>
        </div>
        <div className="h-px bg-stone-50"></div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-stone-800">Balance</span>
          <span
            className={`font-mono text-sm font-medium ${balance >= 0 ? "text-teal-800" : "text-red-600"}`}
          >
            {balance >= 0 ? "+" : "−"}
            {formatAmount({ amount: Math.abs(balance) })}
          </span>
        </div>
      </div>
    </div>
  );
}

function TopCategories({
  transactions,
  categories = [],
}: {
  transactions: Transaction[];
  categories?: Category[];
}) {
  const expenses = transactions.filter(
    (transaction) => transaction.type === TRANSACTION_TYPES.EXPENSE,
  );

  const categoryTotals = expenses.reduce<Record<string, number>>((totals, transaction) => {
    const catId = transaction.categoryId ?? "uncategorized";
    totals[catId] = (totals[catId] ?? 0) + transaction.amount;
    return totals;
  }, {});

  const topCategoryTotals = Object.entries(categoryTotals)
    .sort(([, totalA], [, totalB]) => totalB - totalA)
    .slice(0, 5);

  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return (
    <div className="bg-white border border-stone-100 rounded-xl p-5">
      <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-4">
        Top categories
      </p>
      <div className="flex flex-col gap-3">
        {topCategoryTotals.map(([catId, total]) => {
          const category = categoryMap.get(catId);
          const emoji = category?.emoji ?? "📦";
          const name = category?.name ?? "Uncategorized";
          return (
            <div key={catId} className="flex items-center gap-3">
              <span className="text-sm shrink-0">{emoji}</span>
              <span className="text-sm text-stone-700 flex-1">{name}</span>
              <span className="font-mono text-xs text-stone-400">
                {formatAmount({ amount: total })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickAddLink() {
  return (
    <Link
      href="/transactions/new"
      className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-center gap-3 hover:border-teal-400 transition-colors group"
    >
      <div className="w-9 h-9 rounded-lg bg-teal-400 flex items-center justify-center text-white text-lg shrink-0 group-hover:bg-teal-600 transition-colors">
        ＋
      </div>
      <div>
        <p className="text-sm font-medium text-teal-800">New transaction</p>
        <p className="text-xs text-teal-600 mt-0.5">Record now</p>
      </div>
    </Link>
  );
}

export default function SummaryPanel({
  transactions,
  categories = [],
}: {
  transactions: Transaction[];
  categories?: Category[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <MonthlySummary transactions={transactions} />
      <TopCategories transactions={transactions} categories={categories} />
      <QuickAddLink />
    </div>
  );
}
