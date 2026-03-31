import { Transaction } from "@/types/Transaction.types";
import type { Category } from "@/types/Category.types";
import { getDateGroupLabel } from "@/lib/dates";
import { groupTransactionsByDate } from "@/utils/transaction.groups";
import TransactionItem from "@/components/TransactionItem";

export default function TransactionList({
  transactions,
  categories = [],
}: {
  transactions: Transaction[];
  categories?: Category[];
}) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const groups = groupTransactionsByDate(transactions);

  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-stone-100 rounded-xl p-8 text-center">
        <p className="text-sm text-stone-400">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([dateKey, txns]) => (
        <div key={dateKey}>
          <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-2.5">
            {getDateGroupLabel(txns[0].date)}
          </p>
          <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
            <ul className="divide-y divide-stone-50" role="list">
              {txns.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  categoryEmoji={t.categoryId ? categoryMap.get(t.categoryId)?.emoji : undefined}
                />
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
