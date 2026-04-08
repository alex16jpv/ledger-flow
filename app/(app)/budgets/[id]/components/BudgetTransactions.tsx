"use client";

import { useEffect, useState, useCallback } from "react";
import { Budget } from "@/types/Budget.types";
import { Transaction } from "@/types/Transaction.types";
import { Category } from "@/types/Category.types";
import { Account } from "@/types/Account.types";
import TransactionItem from "@/components/TransactionItem";
import { getDateGroupLabel } from "@/lib/dates";
import { groupTransactionsByDate } from "@/utils/transaction.groups";
import { getTransactions } from "@/services/transactions.service";
import { getCategories } from "@/services/categories.service";
import { getAccounts } from "@/services/accounts.service";
import { DEFAULT_LIST_LIMIT } from "@/utils/constants";

export default function BudgetTransactions({ budget }: { budget: Budget }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [transactionResult, categoriesResult, accountsResult] =
      await Promise.all([
        getTransactions({ type: "EXPENSE", limit: DEFAULT_LIST_LIMIT }),
        getCategories({ limit: DEFAULT_LIST_LIMIT }),
        getAccounts({ limit: DEFAULT_LIST_LIMIT }),
      ]);
    if (transactionResult.error) {
      setError(transactionResult.error);
    } else {
      const allTransactions = transactionResult.data?.data ?? [];
      const filtered = allTransactions
        .filter((transaction) => transaction.categoryId === budget.categoryId)
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
      setTransactions(filtered);
    }
    setCategories(categoriesResult.data?.data ?? []);
    setAccounts(accountsResult.data?.data ?? []);
    setIsLoading(false);
  }, [budget.categoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const category = categoryMap.get(budget.categoryId);
  const categoryEmoji = category?.emoji;
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const groups = groupTransactionsByDate(transactions);

  if (isLoading) {
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
        groups.map(([dateKey, dateTransactions]) => (
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
                    categoryEmoji={
                      transaction.categoryId === budget.categoryId
                        ? categoryEmoji
                        : undefined
                    }
                    accountNames={accountNames}
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
