"use client";

import { useEffect, useState, useCallback } from "react";
import TransactionItem from "@/components/TransactionItem";
import { getTransactions } from "@/services/transactions.service";
import { getCategories } from "@/services/categories.service";
import { Transaction } from "@/types/Transaction.types";
import { Category } from "@/types/Category.types";
import Link from "next/link";

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [txResult, catResult] = await Promise.all([
      getTransactions({ limit: "5" }),
      getCategories({ limit: "100" }),
    ]);
    if (txResult.error) {
      setError(txResult.error);
    } else {
      setTransactions(txResult.data?.data ?? []);
    }
    setCategories(catResult.data?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  if (loading) {
    return (
      <div className="lg:col-span-2 bg-white border border-stone-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-sm font-medium text-stone-800">Recent Movements</h2>
        </div>
        <div className="p-6 animate-pulse flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-stone-100 rounded" />
          ))}
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
    </div>
  );
}
