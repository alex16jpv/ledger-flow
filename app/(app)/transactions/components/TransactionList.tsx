import { Transaction } from "@/types/Transaction.types";
import { getDateGroupLabel, getDateGroupKey } from "@/lib/dates";
import TransactionItem from "@/components/TransactionItem";

function groupTransactionsByDate(
  transactions: Transaction[],
): [string, Transaction[]][] {
  const sorted = [...transactions].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const groups = new Map<string, Transaction[]>();

  for (const t of sorted) {
    const key = getDateGroupKey(t.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return Array.from(groups.entries());
}

export default function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
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
                <TransactionItem key={t.id} transaction={t} />
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
