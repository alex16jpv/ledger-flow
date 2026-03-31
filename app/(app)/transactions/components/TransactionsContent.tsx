"use client";

import { useState } from "react";
import { Transaction, TransactionKind } from "@/types/Transaction.types";
import type { Category } from "@/types/Category.types";
import FilterChips from "./FilterChips";
import TransactionList from "./TransactionList";

export default function TransactionsContent({
  transactions,
  categories = [],
}: {
  transactions: Transaction[];
  categories?: Category[];
}) {
  const [activeFilter, setActiveFilter] = useState<TransactionKind | null>(
    null,
  );

  const filteredTransactions = activeFilter
    ? transactions.filter((t) => t.type === activeFilter)
    : transactions;

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      <FilterChips
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      <TransactionList transactions={filteredTransactions} categories={categories} />
    </div>
  );
}
