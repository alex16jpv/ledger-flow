"use client";

import { useEffect, useState, useCallback } from "react";
import { Budget } from "@/types/Budget.type";
import { Transaction } from "@/types/Transaction.types";
import { Category } from "@/types/Category.types";
import TransactionItem from "@/components/TransactionItem";
import { getDateGroupLabel } from "@/lib/dates";
import { groupTransactionsByDate } from "@/utils/transaction.groups";
import { getTransactions } from "@/services/transactions.service";
import { getCategories } from "@/services/categories.service";

export default function BudgetTransactions({ budget }: { budget: Budget }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [txResult, catResult] = await Promise.all([
      getTransactions({ type: "EXPENSE", limit: "100" }),
      getCategories({ limit: "100" }),
    ]);
    if (txResult.error) {
      setError(txResult.error);
    } else {
      const all = txResult.data?.data ?? [];
      setTransactions(
        all
          .filter((t) => t.categoryId === budget.categoryId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      );
    }
    setCategories(catResult.data?.data ?? []);
    setLoading(false);
  }, [budget.categoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const groups = groupTransactionsByDate(transactions);

  if (loading) {
    return (
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="h-4 w-40 bg-stone-100 rounded animate-pulse" />
        <div className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse">
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
