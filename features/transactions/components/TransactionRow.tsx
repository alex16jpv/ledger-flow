"use client";

import { HandCoins, Hash, Repeat, Scale, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Row, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { Tile } from "@/components/ui/Tile";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { SharedLookup } from "@/lib/shared/lookup";
import type { Account, Category, Transaction } from "@/types/api";

import { amountKind } from "../groups";

export interface TransactionLookups {
  accounts: ReadonlyMap<string, Account>;
  categories: ReadonlyMap<string, Category>;
  // The app layer fills it from the shared section: a feature never imports another.
  shared?: SharedLookup;
}

export interface TransactionRowProps {
  transaction: Transaction;
  lookups: TransactionLookups;
  dated?: boolean;
  // Left out where the row is read and not a way anywhere: it is then no longer a control.
  onOpen?: (transaction: Transaction) => void;
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
  const ids = [transaction.id, transaction.sharedExpenseId ?? ""];
  const queued = ids.some((id) => outbox.queuedRows.has(id));
  const stuck = ids.some((id) => outbox.attentionRows.has(id));
  const when = new Date(transaction.date);
  // A list that spans days answers "when" with the day the row froze, never with the instant.
  const frozen = transaction.dayKey ?? dates.dayKey(when);
  const meta = [
    dated ? dates.formatWeekdayDayShort(dates.fromDayKey(frozen)) : dates.formatTime(when),
    transaction.type === "TRANSFER" ? t("transactionTypes.TRANSFER") : account?.name,
    queued ? t("states.savedHere") : undefined,
  ];

  const body = (
    <>
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
          {queued && <SyncBadge sync={stuck ? "attention" : "pending"} />}
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
    </>
  );

  return onOpen ? (
    <RowButton
      pending={transaction.pendingDetails}
      onClick={() => {
        onOpen(transaction);
      }}
    >
      {body}
    </RowButton>
  ) : (
    <Row pending={transaction.pendingDetails}>{body}</Row>
  );
}
