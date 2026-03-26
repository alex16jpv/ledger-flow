"use client";

import { useState } from "react";
import { Transaction, TransactionKind } from "@/types/Transaction.types";
import { MOCK_TRANSACTIONS } from "@/lib/mock/transactions.mock";
import { Account } from "@/types/Account.types";
import TransactionItem from "@/components/TransactionItem";
import { getDateGroupLabel, getDateGroupKey } from "@/lib/dates";
import FilterChips from "@/app/(app)/transactions/components/FilterChips";

function getAccountTransactions(account: Account): Transaction[] {
  return MOCK_TRANSACTIONS.filter((t) => {
    if (t.type === "EXPENSE" && t.from_account_id === account.name) return true;
    if (t.type === "INCOME" && t.to_account_id === account.name) return true;
    if (
      t.type === "TRANSFER" &&
      (t.from_account_id === account.name || t.to_account_id === account.name)
    )
      return true;
    return false;
  }).sort((a, b) => b.date.getTime() - a.date.getTime());
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = getDateGroupKey(t.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return Array.from(groups.entries());
}

export default function AccountTransactions({ account }: { account: Account }) {
  const [activeFilter, setActiveFilter] = useState<TransactionKind | null>(
    null,
  );

  const allTransactions = getAccountTransactions(account);
  const filtered = activeFilter
    ? allTransactions.filter((t) => t.type === activeFilter)
    : allTransactions;
  const groups = groupByDate(filtered);

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      <FilterChips
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-100 rounded-xl p-8 text-center">
          <p className="text-sm text-stone-400">
            No transactions found for this account
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
                  <TransactionItem key={t.id} transaction={t} />
                ))}
              </ul>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
