import type { AmountKind } from "@/components/ui/Amount";
import { dayKey } from "@/lib/format/dates";
import type { Transaction } from "@/types/api";

export interface DayGroup {
  day: string;
  date: Date;
  items: Transaction[];
}

// The day is the one the server froze on the row; `timeZone` answers for rows written before it.
export function groupByDay(transactions: readonly Transaction[], timeZone: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    const day = transaction.dayKey ?? dayKey(date, timeZone);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(transaction);
    else groups.push({ day, date, items: [transaction] });
  }
  return groups;
}

export type AmountRow = Pick<Transaction, "type" | "fromAccountId">;

// A payment between people goes both ways: collecting reaches an account, giving back leaves one.
export function amountKind(row: AmountRow): AmountKind {
  switch (row.type) {
    case "EXPENSE":
      return "expense";
    case "INCOME":
      return "income";
    case "TRANSFER":
      return "transfer";
    case "ADJUSTMENT":
      return "adjustment";
    case "SETTLEMENT":
      return row.fromAccountId === null ? "settlement" : "settlementOut";
  }
}
