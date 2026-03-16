import { TransactionType } from "@/types/Transaction.types";
import { formatAmount } from "@/utils/utils";

const TYPE_COLORS = {
  EXPENSE: "text-red-600",
  INCOME: "text-green-600",
  TRANSFER: "text-blue-600",
} as const;

const TYPE_LABELS = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
} as const;

const TYPE_PREFIXES = {
  EXPENSE: "− ",
  INCOME: "+ ",
  TRANSFER: "⇄ ",
} as const;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
};
const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  // hour12: false,
};

const TRANSACTION_LABELS: Record<TransactionType["type"], string> = {
  TRANSFER: "Internal Transfer",
  INCOME: "Income",
  EXPENSE: "Expense",
};

function getSubtitle(transaction: TransactionType): string {
  const label = TRANSACTION_LABELS[transaction.type];

  if (transaction.type === "TRANSFER") {
    return `${label} · ${transaction.from_account_id} → ${transaction.to_account_id}`;
  }

  if (transaction.type === "INCOME") {
    return `${label} · ${transaction.to_account_id}`;
  }

  if (transaction.type === "EXPENSE") {
    const category = transaction.category ?? "Uncategorized";
    return `${label} · ${category} · ${transaction.from_account_id}`;
  }

  return label;
}

export default function TransactionItem({
  transaction,
}: {
  transaction: TransactionType;
}) {
  const dateString = transaction.date.toLocaleDateString("en-US", DATE_OPTIONS);
  const timeString = transaction.date.toLocaleTimeString("en-US", TIME_OPTIONS);
  const dateTimeString = `${dateString} · ${timeString}`;

  const amountColor = TYPE_COLORS[transaction.type];
  const amountPrefix = TYPE_PREFIXES[transaction.type];
  const formattedAmount = formatAmount({
    amount: transaction.amount,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const amountAriaLabel = `${TYPE_LABELS[transaction.type]}: ${formattedAmount}`;

  return (
    <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg shrink-0">
        🛒
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">
          {transaction?.description
            ? transaction.description
            : `${transaction.type.toLowerCase()} Transaction`}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">
          {getSubtitle(transaction)}
        </p>
      </div>
      {/* Category Badge */}
      {/* <div className="hidden sm:flex items-center gap-3">
        <span className="bg-teal-50 text-teal-800 font-mono text-[10px] px-2 py-0.5 rounded-full">
          {transaction.category ?? "Uncategorized"}
        </span>
      </div> */}
      <div className="text-right">
        <p
          className={`font-mono text-sm font-medium ${amountColor}`}
          aria-label={amountAriaLabel}
        >
          {amountPrefix}
          {formattedAmount}
        </p>
        <p className="font-mono text-[10px] text-stone-300 mt-0.5">
          {dateTimeString}
        </p>
      </div>
    </li>
  );
}
