"use client";

import { useState } from "react";
import { Transaction, TransactionKind } from "@/types/Transaction.types";
import FilterChips from "./FilterChips";
import TransactionList from "./TransactionList";
import SummaryPanel from "./SummaryPanel";

export default function TransactionsContent({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const [activeFilter, setActiveFilter] = useState<TransactionKind | null>(
    null,
  );

  const filteredTransactions = activeFilter
    ? transactions.filter((t) => t.type === activeFilter)
    : transactions;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <FilterChips
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
        <TransactionList transactions={filteredTransactions} />
      </div>
      <SummaryPanel transactions={transactions} />
    </div>
  );
}
