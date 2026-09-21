"use client";

import { CloudOff, HandCoins, Hash, Repeat, Scale, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Account, Category, Transaction } from "@/types/api";

import { amountKind } from "../groups";

// Plain maps the app layer fills from the shared section: a feature never imports another.
export interface TransactionLookups {
  accounts: ReadonlyMap<string, Account>;
  categories: ReadonlyMap<string, Category>;
  shared?: {
    expenses: ReadonlyMap<string, { yourShare: number; groupName: string }>;
    payments: ReadonlyMap<string, { name: string; groups: string[] }>;
  };
}

export interface TransactionRowProps {
  transaction: Transaction;
  lookups: TransactionLookups;
  dated?: boolean;
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
  // A payment reads as the person it was with: it has no category and needs none.
  if (transaction.type === "SETTLEMENT") {
    const payment = lookups.shared?.payments.get(transaction.sharedSettlementId ?? "");
    if (payment?.name) return payment.name;
    return t("transactionTypes.SETTLEMENT");
  }
  const category = lookups.categories.get(transaction.categoryId ?? "");
  if (category) return category.name;
  return transaction.source === "QUICK"
    ? t(`transactions.list.quick.${transaction.type}`)
    : t(`transactionTypes.${transaction.type}`);
}

export function TransactionRow({ transaction, lookups, dated, onOpen }: TransactionRowProps) {
  const t = useTranslations();
  const dates = useDates();
  const outbox = useOutbox();
  const category = lookups.categories.get(transaction.categoryId ?? "");
  const account = lookups.accounts.get(transaction.fromAccountId ?? transaction.toAccountId ?? "");
  const money = useMoney();
  const shared = lookups.shared?.expenses.get(transaction.sharedExpenseId ?? "");
  const payment = lookups.shared?.payments.get(transaction.sharedSettlementId ?? "");
  // F-16 (a): an unconfirmed movement says so on its own row, since the figures include it.
  const queued = outbox.queuedRows.has(transaction.id);
  const stuck = outbox.attentionRows.has(transaction.id);
  const when = new Date(transaction.date);
  // A list that spans days answers "when" with the day the row froze, never with the instant.
  const frozen = transaction.dayKey ?? dates.dayKey(when);
  const meta = [
    dated ? dates.formatWeekdayDayShort(dates.fromDayKey(frozen)) : dates.formatTime(when),
    transaction.type === "TRANSFER" ? t("transactionTypes.TRANSFER") : account?.name,
    queued ? t("states.savedHere") : undefined,
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
          color={
            transaction.type === "TRANSFER" || transaction.type === "SETTLEMENT" ? "GRAY" : null
          }
          className="bg-surface-2 text-text-2"
        >
          {transaction.type === "ADJUSTMENT" ? (
            <Scale {...iconProps("md")} />
          ) : transaction.type === "SETTLEMENT" ? (
            <HandCoins {...iconProps("md")} />
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
          {queued && (
            <Badge tone={stuck ? "danger" : "warning"}>
              <CloudOff aria-hidden="true" />
              {t(stuck ? "states.needsAttention" : "states.pendingSync")}
            </Badge>
          )}
          {transaction.pendingDetails && (
            <Badge tone="warning">{t("transactions.list.toReview")}</Badge>
          )}
          {transaction.type === "ADJUSTMENT" && <Badge>{t("transactionTypes.ADJUSTMENT")}</Badge>}
          {transaction.type === "SETTLEMENT" && (
            <Badge>
              <HandCoins aria-hidden="true" />
              {t("transactions.list.payment")}
            </Badge>
          )}
          {transaction.sharedExpenseId !== null && (
            <Badge>
              <Users aria-hidden="true" />
              {t("transactions.list.shared")}
            </Badge>
          )}
        </RowTitle>
        <RowMeta items={meta} />
      </RowBody>
      <RowRight
        sub={
          // The row keeps the gross amount and says underneath what the split says is fairly yours.
          shared
            ? t("transactions.list.yourShare", { amount: money.format(shared.yourShare) })
            : payment
              ? payment.groups.join(" · ")
              : transaction.tags.length > 0
                ? transaction.tags.map((tag) => `#${tag}`).join(" ")
                : undefined
        }
      >
        <Amount value={transaction.amount} kind={amountKind(transaction)} />
      </RowRight>
    </RowButton>
  );
}
