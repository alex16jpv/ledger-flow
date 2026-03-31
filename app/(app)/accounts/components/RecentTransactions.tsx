import Link from "next/link";
import { MOCK_TRANSACTIONS } from "@/lib/mock/transactions.mock";
import { MOCK_CATEGORIES } from "@/lib/mock/categories.mock";
import TransactionItem from "@/components/TransactionItem";

export default function RecentTransactions() {
  const categoryMap = new Map(MOCK_CATEGORIES.map((c) => [c.id, c]));
  const recentTransactions = [...MOCK_TRANSACTIONS]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  return (
    <section
      aria-label="Recent transactions"
      className="bg-white border border-stone-100 rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h2 className="text-sm font-medium text-stone-800">
          Recent Transactions
        </h2>
        <Link
          href="/transactions"
          className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
        >
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-stone-50" role="list">
        {recentTransactions.map((transaction) => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            categoryEmoji={transaction.categoryId ? categoryMap.get(transaction.categoryId)?.emoji : undefined}
          />
        ))}
      </ul>
    </section>
  );
}
