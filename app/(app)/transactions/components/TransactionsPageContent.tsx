"use client";

import { useEffect, useState, useCallback } from "react";
import { getTransactions } from "@/services/transactions.service";
import { getCategoriesByIds } from "@/services/categories.service";
import { getAccountsByIds } from "@/services/accounts.service";
import { Transaction } from "@/types/Transaction.types";
import { Category } from "@/types/Category.types";
import { Account } from "@/types/Account.types";
import { DEFAULT_LIST_LIMIT } from "@/utils/constants";
import TransactionsContent from "./TransactionsContent";
import SummaryPanel from "./SummaryPanel";

export default function TransactionsPageContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const transactionResult = await getTransactions({ limit: DEFAULT_LIST_LIMIT });
    if (transactionResult.error) {
      setError(transactionResult.error);
      setIsLoading(false);
      return;
    }
    const fetchedTransactions = transactionResult.data?.data ?? [];
    setTransactions(fetchedTransactions);

    const uniqueCategoryIds = [...new Set(
      fetchedTransactions.map((transaction) => transaction.categoryId).filter((id): id is string => !!id),
    )];
    const uniqueAccountIds = [...new Set(
      fetchedTransactions.flatMap((transaction) => [transaction.fromAccountId, transaction.toAccountId]).filter((id): id is string => !!id),
    )];
    const [categoryResult, accountResult] = await Promise.all([
      getCategoriesByIds(uniqueCategoryIds),
      getAccountsByIds(uniqueAccountIds),
    ]);
    setCategories(categoryResult.data?.data ?? []);
    setAccounts(accountResult.data?.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <>
        <div className="lg:col-span-2 flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse"
            >
              <div className="h-3 w-24 bg-stone-100 rounded mb-3" />
              <div className="h-12 w-full bg-stone-100 rounded" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-stone-100 rounded-xl p-5 animate-pulse">
            <div className="h-3 w-20 bg-stone-100 rounded mb-4" />
            <div className="h-8 w-full bg-stone-100 rounded" />
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="lg:col-span-3 bg-red-50 border border-red-100 rounded-xl p-8 text-center">
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
    <>
      <TransactionsContent transactions={transactions} categories={categories} accounts={accounts} />
      <SummaryPanel transactions={transactions} categories={categories} />
    </>
  );
}
