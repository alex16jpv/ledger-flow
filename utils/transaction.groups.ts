import { Transaction } from "@/types/Transaction.types";
import { getDateGroupKey } from "@/lib/dates";

export function groupTransactionsByDate(
  transactions: Transaction[],
): [string, Transaction[]][] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const groups = new Map<string, Transaction[]>();

  for (const transaction of sorted) {
    const key = getDateGroupKey(transaction.date);
    if (!groups.has(key)) groups.set(key, []);
    const group = groups.get(key) ?? [];
    group.push(transaction);
  }

  return Array.from(groups.entries());
}
