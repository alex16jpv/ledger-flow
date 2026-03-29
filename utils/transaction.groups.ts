import { Transaction } from "@/types/Transaction.types";
import { getDateGroupKey } from "@/lib/dates";

export function groupTransactionsByDate(
  transactions: Transaction[],
): [string, Transaction[]][] {
  const sorted = [...transactions].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const groups = new Map<string, Transaction[]>();

  for (const t of sorted) {
    const key = getDateGroupKey(t.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return Array.from(groups.entries());
}
