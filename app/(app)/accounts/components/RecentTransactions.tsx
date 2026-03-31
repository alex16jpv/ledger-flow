"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getTransactions } from "@/services/transactions.service";
import { getCategories } from "@/services/categories.service";
import { Transaction } from "@/types/Transaction.types";
import { Category } from "@/types/Category.types";
import TransactionItem from "@/components/TransactionItem";
import { DEFAULT_LIST_LIMIT, RECENT_ITEMS_LIMIT } from "@/utils/constants";

export default function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [transactionResult, categoryResult] = await Promise.all([
      getTransactions({ limit: RECENT_ITEMS_LIMIT }),
      getCategories({ limit: DEFAULT_LIST_LIMIT }),
    ]);
    if (transactionResult.error) {
      setError(transactionResult.error);
    } else {
      setTransactions(transactionResult.data?.data ?? []);
    }
    setCategories(categoryResult.data?.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  if (isLoading) {
    return (
      <section
        aria-label="Recent transactions loading"
        className="bg-white border border-stone-100 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-medium text-stone-800">
            Recent Transactions
          </h2>
        </div>
        <div className="p-5 animate-pulse flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-stone-100 rounded" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          onClick={fetchData}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          Try again
        </button>
      </section>
    );
  }

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
      {transactions.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-stone-400">No transactions yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-50" role="list">
          {transactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              categoryEmoji={transaction.categoryId ? categoryMap.get(transaction.categoryId)?.emoji : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
