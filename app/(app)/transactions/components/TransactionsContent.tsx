"use client";

import { useState } from "react";
import { Transaction, TransactionKind } from "@/types/Transaction.types";
import type { Category } from "@/types/Category.types";
import type { Account } from "@/types/Account.types";
import FilterChips from "./FilterChips";
import TransactionList from "./TransactionList";

export default function TransactionsContent({
  transactions,
  categories = [],
  accounts = [],
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  syncButton,
}: {
  transactions: Transaction[];
  categories?: Category[];
  accounts?: Account[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  syncButton?: React.ReactNode;
}) {
  const [activeFilter, setActiveFilter] = useState<TransactionKind | null>(
    null,
  );

  const filteredTransactions = activeFilter
    ? transactions.filter((transaction) => transaction.type === activeFilter)
    : transactions;

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <FilterChips
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </div>
        {syncButton}
      </div>
      <TransactionList
        transactions={filteredTransactions}
        categories={categories}
        accounts={accounts}
      />
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="font-mono text-xs rounded-full px-6 py-2.5 bg-white border border-stone-200 text-stone-600 hover:border-teal-400 hover:text-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
