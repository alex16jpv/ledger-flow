import { Budget } from "@/types/Budget.type";
import { MOCK_TRANSACTIONS } from "@/lib/mock/transactions.mock";
import { MOCK_CATEGORIES } from "@/lib/mock/categories.mock";
import TransactionItem from "@/components/TransactionItem";
import { getDateGroupLabel } from "@/lib/dates";
import { groupTransactionsByDate } from "@/utils/transaction.groups";
import { Transaction } from "@/types/Transaction.types";

function getBudgetTransactions(budget: Budget): Transaction[] {
  return MOCK_TRANSACTIONS.filter(
    (t) =>
      t.type === "EXPENSE" &&
      t.categoryId === budget.categoryId,
  ).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export default function BudgetTransactions({ budget }: { budget: Budget }) {
  const categoryMap = new Map(MOCK_CATEGORIES.map((c) => [c.id, c]));
  const transactions = getBudgetTransactions(budget);
  const groups = groupTransactionsByDate(transactions);

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-stone-800">
          Related Transactions
        </h2>
        <span className="font-mono text-xs text-stone-400">
          {transactions.length} transaction
          {transactions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white border border-stone-100 rounded-xl p-8 text-center">
          <p className="text-sm text-stone-400">
            No transactions found for this budget
          </p>
        </div>
      ) : (
        groups.map(([dateKey, txns]) => (
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
        ))
      )}
    </div>
  );
}
