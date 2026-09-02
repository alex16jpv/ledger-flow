"use client";

import { Hash, Repeat, Scale } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { useDates } from "@/lib/i18n/useDates";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Account, Category, Transaction } from "@/types/api";

import { amountKind } from "../groups";

export interface TransactionLookups {
  accounts: ReadonlyMap<string, Account>;
  categories: ReadonlyMap<string, Category>;
}

export interface TransactionRowProps {
  transaction: Transaction;
  lookups: TransactionLookups;
  onOpen: (transaction: Transaction) => void;
}

type Translate = ReturnType<typeof useTranslations<never>>;

export function transactionTitle(
  transaction: Transaction,
  lookups: TransactionLookups,
  t: Translate,
): string {
  if (transaction.description) return transaction.description;
  if (transaction.type === "TRANSFER") {
    const from = lookups.accounts.get(transaction.fromAccountId ?? "")?.name;
    const to = lookups.accounts.get(transaction.toAccountId ?? "")?.name;
    if (from && to) return `${from} → ${to}`;
  }
  if (transaction.type === "ADJUSTMENT") return t("transactions.list.balanceAdjustment");
  const category = lookups.categories.get(transaction.categoryId ?? "");
  if (category) return category.name;
  return transaction.source === "QUICK"
    ? t("transactions.list.quickExpense")
    : t(`transactionTypes.${transaction.type}`);
}

export function TransactionRow({ transaction, lookups, onOpen }: TransactionRowProps) {
  const t = useTranslations();
  const dates = useDates();
  const category = lookups.categories.get(transaction.categoryId ?? "");
  const account = lookups.accounts.get(transaction.fromAccountId ?? transaction.toAccountId ?? "");
  const meta = [
    dates.formatTime(new Date(transaction.date)),
    transaction.type === "TRANSFER" ? t("transactionTypes.TRANSFER") : account?.name,
  ];

  return (
    <RowButton
      pending={transaction.pendingDetails}
      onClick={() => {
        onOpen(transaction);
      }}
    >
      {category ? (
        <Tile color={category.color}>
          <CategoryIcon icon={category.icon} />
        </Tile>
      ) : (
        <Tile
          color={transaction.type === "TRANSFER" ? "GRAY" : null}
          className="bg-surface-2 text-text-2"
        >
          {transaction.type === "ADJUSTMENT" ? (
            <Scale {...iconProps("md")} />
          ) : transaction.type === "TRANSFER" ? (
            <Repeat {...iconProps("md")} />
          ) : (
            <Hash {...iconProps("md")} />
          )}
        </Tile>
      )}
      <RowBody>
        <RowTitle>
          <span>{transactionTitle(transaction, lookups, t)}</span>
          {transaction.pendingDetails && (
            <Badge tone="warning">{t("transactions.list.toReview")}</Badge>
          )}
          {transaction.type === "ADJUSTMENT" && <Badge>{t("transactionTypes.ADJUSTMENT")}</Badge>}
        </RowTitle>
        <RowMeta items={meta} />
      </RowBody>
      <RowRight
        sub={
          transaction.tags.length > 0
            ? transaction.tags.map((tag) => `#${tag}`).join(" ")
            : undefined
        }
      >
        <Amount value={transaction.amount} kind={amountKind(transaction.type)} />
      </RowRight>
    </RowButton>
  );
}
