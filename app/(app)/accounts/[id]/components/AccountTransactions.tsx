"use client";

import { useState, useEffect, useCallback } from "react";
import { TransactionKind } from "@/types/Transaction.types";
import { Transaction } from "@/types/Transaction.types";
import { Account } from "@/types/Account.types";
import { Category } from "@/types/Category.types";
import TransactionItem from "@/components/TransactionItem";
import { getDateGroupLabel } from "@/lib/dates";
import { groupTransactionsByDate } from "@/utils/transaction.groups";
import FilterChips from "@/app/(app)/transactions/components/FilterChips";
import { getTransactions } from "@/services/transactions.service";
import { getCategories } from "@/services/categories.service";
import { DEFAULT_LIST_LIMIT } from "@/utils/constants";

export default function AccountTransactions({ account }: { account: Account }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TransactionKind | null>(
    null,
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [transactionResult, categoryResult] = await Promise.all([
      getTransactions({ accountId: account.id, limit: DEFAULT_LIST_LIMIT }),
      getCategories({ limit: DEFAULT_LIST_LIMIT }),
    ]);
    if (transactionResult.error) {
      setError(transactionResult.error);
    } else {
      setTransactions(transactionResult.data?.data ?? []);
    }
    setCategories(categoryResult.data?.data ?? []);
    setIsLoading(false);
  }, [account.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const filtered = activeFilter
    ? transactions.filter((t) => t.type === activeFilter)
    : transactions;
  const groups = groupTransactionsByDate(filtered);

  if (isLoading) {
    return (
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse">
          <div className="h-3 w-24 bg-stone-100 rounded mb-3" />
          <div className="h-12 w-full bg-stone-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lg:col-span-2 bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          onClick={fetchData}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

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
