import TransactionItem from "@/components/TransactionItem";
import { MOCK_TRANSACTIONS } from "@/lib/mock/transactions.mock";
import Link from "next/link";

export default function Transactions() {
  return (
    <div className="lg:col-span-2 bg-white border border-stone-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <h2 className="text-sm font-medium text-stone-800">Recent Movements</h2>
        <Link
          href="/transactions"
          className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
        >
          View all →
        </Link>
      </div>

      <ul className="divide-y divide-stone-50" role="list">
        {MOCK_TRANSACTIONS.map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
      </ul>
    </div>
  );
}
