import TransactionItem from "@/components/TransactionItem";
import { TransactionType } from "@/types/Transaction.types";
import Link from "next/link";

const mockExpenseTransaction: TransactionType = {
  id: "id_transaction_1",
  type: "EXPENSE", // "INCOME", "TRANSFER", "EXPENSE"
  amount: 3200,
  date: new Date("2024-03-14T16:40:00"),
  category: "Shopping",
  description: "Bought a new laptop",
  from_account_id: "id_account_from",
};

const mockIncomeTransaction: TransactionType = {
  id: "id_transaction_2",
  type: "INCOME", // "INCOME", "TRANSFER", "EXPENSE"
  amount: 5000,
  date: new Date("2024-03-01T09:00:00"),
  category: "Salary",
  description: "March Salary",
  to_account_id: "id_account_to",
};

const mockTransferTransaction: TransactionType = {
  id: "id_transaction_3",
  type: "TRANSFER", // "INCOME", "TRANSFER", "EXPENSE"
  amount: 1500,
  date: new Date("2024-03-10T14:30:00"),
  category: "Savings",
  description: "Transfer to Savings",
  from_account_id: "id_account_from",
  to_account_id: "id_account_to",
};

export default function Transactions() {
  return (
    <div className="lg:col-span-2 bg-white border border-stone-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <h2 className="text-sm font-medium text-stone-800">Recent Movements</h2>
        <Link
          href="/transactions"
          className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
        >
          View all →
        </Link>
      </div>

      <ul className="divide-y divide-stone-50" role="list">
        <TransactionItem transaction={mockExpenseTransaction} />
        <TransactionItem transaction={mockIncomeTransaction} />
        <TransactionItem transaction={mockTransferTransaction} />
      </ul>
    </div>
  );
}
