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
}: {
  transactions: Transaction[];
  categories?: Category[];
  accounts?: Account[];
}) {
  const [activeFilter, setActiveFilter] = useState<TransactionKind | null>(
    null,
  );

  const filteredTransactions = activeFilter
    ? transactions.filter((transaction) => transaction.type === activeFilter)
    : transactions;

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      <FilterChips
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      <TransactionList transactions={filteredTransactions} categories={categories} accounts={accounts} />
    </div>
  );
}
