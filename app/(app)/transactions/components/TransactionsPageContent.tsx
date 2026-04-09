"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getTransactions } from "@/services/transactions.service";
import { getCategories } from "@/services/categories.service";
import { getAccounts } from "@/services/accounts.service";
import { Transaction } from "@/types/Transaction.types";
import { Category } from "@/types/Category.types";
import { Account } from "@/types/Account.types";
import {
  DEFAULT_LIST_LIMIT,
  TRANSACTIONS_DEFAULT_LIMIT,
  TRANSACTIONS_LOAD_MORE_LIMIT,
} from "@/utils/constants";
import TransactionsContent from "./TransactionsContent";
import SummaryPanel from "./SummaryPanel";

export default function TransactionsPageContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [transactionResult, categoryResult, accountResult] =
      await Promise.all([
        getTransactions({ limit: TRANSACTIONS_DEFAULT_LIMIT }),
        getCategories({ limit: DEFAULT_LIST_LIMIT }),
        getAccounts({ limit: DEFAULT_LIST_LIMIT }),
      ]);
    if (transactionResult.error) {
      setError(transactionResult.error);
      setIsLoading(false);
      return;
    }
    const newTransactions = transactionResult.data?.data ?? [];
    setTransactions(newTransactions);
    setHasMore(transactionResult.data?.pagination?.hasMore ?? false);
    offsetRef.current = newTransactions.length;
    setCategories(categoryResult.data?.data ?? []);
    setAccounts(accountResult.data?.data ?? []);
    setIsLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    const result = await getTransactions({
      limit: TRANSACTIONS_LOAD_MORE_LIMIT,
      offset: String(offsetRef.current),
    });
    if (!result.error && result.data) {
      const moreTransactions = result.data.data ?? [];
      setTransactions((prev) => [...prev, ...moreTransactions]);
      setHasMore(result.data.pagination?.hasMore ?? false);
      offsetRef.current += moreTransactions.length;
    }
    setIsLoadingMore(false);
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
      <TransactionsContent
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
      />
      <SummaryPanel transactions={transactions} categories={categories} />
    </>
  );
}
