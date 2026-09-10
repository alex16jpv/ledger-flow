import { dayKey } from "@/lib/format/dates";
import type { Transaction } from "@/types/api";

export interface DayGroup {
  day: string;
  date: Date;
  items: Transaction[];
}

// Rows arrive sorted by date desc; grouping only cuts them where the day changes. The day is the
// one the server froze on the row, so a header cannot disagree with the total of the period it is
// under after the account changes time zone; `timeZone` still answers for a row written before it.
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

export function amountKind(
  type: Transaction["type"],
): "expense" | "income" | "transfer" | "adjustment" {
  switch (type) {
    case "EXPENSE":
      return "expense";
    case "INCOME":
      return "income";
    case "TRANSFER":
      return "transfer";
    case "ADJUSTMENT":
      return "adjustment";
  }
}
