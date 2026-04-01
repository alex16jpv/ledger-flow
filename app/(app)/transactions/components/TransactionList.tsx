import { Transaction } from "@/types/Transaction.types";
import type { Category } from "@/types/Category.types";
import type { Account } from "@/types/Account.types";
import { getDateGroupLabel } from "@/lib/dates";
import { groupTransactionsByDate } from "@/utils/transaction.groups";
import TransactionItem from "@/components/TransactionItem";

export default function TransactionList({
  transactions,
  categories = [],
  accounts = [],
}: {
  transactions: Transaction[];
  categories?: Category[];
  accounts?: Account[];
}) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const accountNameMap = new Map(accounts.map((account) => [account.id, account.name]));
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
      {groups.map(([dateKey, dateTransactions]) => (
        <div key={dateKey}>
          <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-2.5">
            {getDateGroupLabel(dateTransactions[0].date)}
          </p>
          <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
            <ul className="divide-y divide-stone-50" role="list">
              {dateTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  categoryEmoji={transaction.categoryId ? categoryMap.get(transaction.categoryId)?.emoji : undefined}
                  accountNames={accountNameMap}
                />
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
