"use client";

import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { DayHeader, List } from "@/components/ui/Row";
import { useDates } from "@/lib/i18n/useDates";
import type { Transaction } from "@/types/api";

import { groupByDay } from "../groups";
import { type TransactionLookups, TransactionRow } from "./TransactionRow";

export interface TransactionDayListProps {
  transactions: readonly Transaction[];
  lookups: TransactionLookups;
  dayTotals?: ReadonlyMap<string, number> | null;
  onOpen: (transaction: Transaction) => void;
}

export function TransactionDayList({
  transactions,
  lookups,
  dayTotals,
  onOpen,
}: TransactionDayListProps) {
  const t = useTranslations("common");
  const dates = useDates();
  const now = new Date();
  const today = dates.dayKey(now);
  const yesterday = dates.dayKey(new Date(now.getTime() - 86_400_000));

  return (
    <Card flush>
      <List>
        {groupByDay(transactions, dates.timeZone).map((group) => {
          const prefix =
            group.day === today ? t("today") : group.day === yesterday ? t("yesterday") : null;
          const total = dayTotals?.get(group.day);
          return (
            <section key={group.day} aria-label={dates.formatLong(group.date)}>
              <DayHeader
                label={
                  prefix
                    ? `${prefix} · ${dates.formatWeekdayDay(group.date)}`
                    : dates.formatWeekdayDay(group.date)
                }
                total={
                  total !== undefined && total !== 0 ? (
                    <Amount
                      value={Math.abs(total)}
                      kind={total < 0 ? "expense" : "income"}
                      size="sm"
                      className="font-normal text-text-3"
                    />
                  ) : undefined
                }
              />
              {group.items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  lookups={lookups}
                  onOpen={onOpen}
                />
              ))}
            </section>
          );
        })}
      </List>
    </Card>
  );
}
