import TransactionItem from "@/components/TransactionItem";
import { TransactionType } from "@/types/Transaction.types";
import Link from "next/link";

const transactions: TransactionType[] = [
  {
    id: "id_transaction_1",
    type: "EXPENSE",
    amount: 3200,
    date: new Date("2024-03-14T16:40:00"),
    category: "Shopping",
    description: "Bought a new laptop",
    from_account_id: "id_account_from",
  },
  {
    id: "id_transaction_2",
    type: "INCOME",
    amount: 5000,
    date: new Date("2024-03-01T09:00:00"),
    category: "Salary",
    description: "March Salary",
    to_account_id: "id_account_to",
  },
  {
    id: "id_transaction_3",
    type: "TRANSFER",
    amount: 1500,
    date: new Date("2024-03-10T14:30:00"),
    category: "Savings",
    description: "Transfer to Savings",
    from_account_id: "id_account_from",
    to_account_id: "id_account_to",
  },
  {
    id: "id_transaction_4",
    type: "EXPENSE",
    amount: 120,
    date: new Date("2024-03-12T19:00:00"),
    category: "Food",
    description: "Dinner at a restaurant",
    from_account_id: "id_account_from",
  },
  {
    id: "id_transaction_5",
    type: "INCOME",
    amount: 200,
    date: new Date("2024-03-05T11:00:00"),
    category: "Freelance",
    description: "Freelance project payment",
    to_account_id: "id_account_to",
  },
  {
    id: "id_transaction_6",
    type: "EXPENSE",
    amount: 80,
    date: new Date("2024-03-08T18:00:00"),
    category: "Entertainment",
    description: "Movie tickets",
    from_account_id: "id_account_from",
  },
  {
    id: "id_transaction_7",
    type: "TRANSFER",
    amount: 500,
    date: new Date("2024-03-15T10:00:00"),
    category: "Investment",
    description: "Transfer to Investment Account",
    from_account_id: "id_account_from",
    to_account_id: "id_account_to",
  },
  {
    id: "id_transaction_8",
    type: "EXPENSE",
    amount: 250,
    date: new Date("2024-03-11T20:00:00"),
    category: "Health",
    description: "Gym membership",
    from_account_id: "id_account_from",
  },
];

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
        {transactions.map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
      </ul>
    </div>
  );
}
