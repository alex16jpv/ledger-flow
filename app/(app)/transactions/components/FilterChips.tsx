import { TransactionKind } from "@/types/Transaction.types";
import { TRANSACTION_TYPES } from "@/utils/constants";

const FILTERS: { label: string; value: TransactionKind | null }[] = [
  { label: "All", value: null },
  { label: "Expenses", value: TRANSACTION_TYPES.EXPENSE },
  { label: "Incomes", value: TRANSACTION_TYPES.INCOME },
  { label: "Transfers", value: TRANSACTION_TYPES.TRANSFER },
];

export default function FilterChips({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: TransactionKind | null;
  onFilterChange: (filter: TransactionKind | null) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
      role="group"
      aria-label="Filters"
    >
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.value;
        return (
          <button
            key={filter.label}
            onClick={() => onFilterChange(filter.value)}
            aria-pressed={isActive}
            className={`shrink-0 font-mono text-xs rounded-full px-3 py-1.5 transition-colors ${
              isActive
                ? "bg-teal-400 border border-teal-400 text-white"
                : "bg-white border border-stone-100 text-stone-500 hover:border-stone-200"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
