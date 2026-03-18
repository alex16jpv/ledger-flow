import { Transaction } from "@/types/Transaction.types";
import { formatAmount } from "@/utils/utils";
import { formatDate } from "@/lib/dates";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPES } from "@/utils/constants";
import { getTransactionSubtitle } from "@/utils/transaction.utils";

const { EXPENSE, INCOME, TRANSFER } = TRANSACTION_TYPES;

const TYPE_COLORS = {
  [EXPENSE]: "text-red-600",
  [INCOME]: "text-green-600",
  [TRANSFER]: "text-blue-600",
} as const;

const TYPE_PREFIXES = {
  [EXPENSE]: "− ",
  [INCOME]: "+ ",
  [TRANSFER]: "⇄ ",
} as const;

export default function TransactionItem({
  transaction,
}: {
  transaction: Transaction;
}) {
  const dateTimeString = formatDate(transaction.date, "dayShortMonthTime");

  const amountColor = TYPE_COLORS[transaction.type];
  const amountPrefix = TYPE_PREFIXES[transaction.type];
  const formattedAmount = formatAmount({
    amount: transaction.amount,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const amountAriaLabel = `${TRANSACTION_TYPE_LABELS[transaction.type]}: ${formattedAmount}`;

  return (
    <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg shrink-0">
        {transaction.emoji ?? "💰"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">
          {transaction.description ||
            `${transaction.type.toLowerCase()} Transaction`}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">
          {getTransactionSubtitle(transaction)}
        </p>
      </div>
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
