"use client";

import {
  CircleAlert,
  HandCoins,
  Hash,
  Pencil,
  Repeat,
  Scale,
  Split,
  Trash2,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, type ReactNode, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { SyncConflictSheet } from "@/components/shell/SyncConflictSheet";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { SplitThisSheet } from "@/features/shared/components/SplitThisSheet";
import { useDeleteSettlement, useSharedSection, useWriteOff } from "@/features/shared/hooks";
import { type PartyView, sharedLookup } from "@/features/shared/ledger";
import { DeleteTransactionSheet } from "@/features/transactions/components/DeleteTransactionSheet";
import {
  type TransactionLookups,
  transactionTitle,
} from "@/features/transactions/components/TransactionRow";
import { amountKind } from "@/features/transactions/groups";
import { useDeleteTransaction, useTransactionQuery } from "@/features/transactions/hooks";
import { ApiError, presentError } from "@/lib/api/errors";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { useBackNavigation } from "@/lib/navigation/history";
import type { Account } from "@/types/api";

import { UndoPaymentSheet } from "../../shared/UndoPaymentSheet";
import { useAdjustmentSheet } from "../../useAdjustmentSheet";
import { deleteImpact, owingParties, SharedExpenseCard } from "./SharedExpenseCard";

function Attribute({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <span className="shrink-0 text-sm text-text-3">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium text-text">{children}</span>
    </div>
  );
}

function AccountValue({ account, fallback }: { account: Account | undefined; fallback: string }) {
  if (!account) return <>{fallback}</>;
  return (
    <span className="inline-flex items-center gap-2">
      <Tile size="sm" color={account.color}>
        {createElement(accountTypeIcon(account.type), iconProps("sm"))}
      </Tile>
      {account.name}
    </span>
  );
}

export function TransactionDetailScreen({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const back = useBackNavigation();
  const toast = useToast();
  const dates = useDates();
  const transaction = useTransactionQuery(id);
  const accounts = useAccountsQuery(true);
  const categories = useCategoriesQuery(undefined);
  const remove = useDeleteTransaction();
  const writeOff = useWriteOff();
  const undoPayment = useDeleteSettlement();
  const outbox = useOutbox();
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const adjustment = useAdjustmentSheet();
  // F-29: DESIGN §8.12 asks for the conflict sheet from Movements; the way in is here, not a row.
  const stuck = outbox.attentionRows.get(id) ?? null;
  const notFound = transaction.error instanceof ApiError && transaction.error.status === 404;
  const row = transaction.data;
  // Only a movement that is in a group or is a payment pays for the section.
  const shared = useSharedSection(
    row !== undefined && (row.sharedExpenseId !== null || row.sharedSettlementId !== null),
  );
  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((account) => [account.id, account])),
      categories: new Map((categories.data ?? []).map((category) => [category.id, category])),
      ...(shared.section ? { shared: sharedLookup(shared.section) } : {}),
    }),
    [accounts.data, categories.data, shared.section],
  );
  const group = shared.section?.groups.find((one) => one.group.id === row?.sharedGroupId);
  const expense = group?.expenses.find((one) => one.id === row?.sharedExpenseId);
  const debtors =
    shared.section && group && expense
      ? owingParties(shared.section, group, expense).filter((one) => one.owesYou > 0)
      : [];
  const onlyDebtor = debtors.length === 1 ? debtors[0] : undefined;
  // Its money belongs to the payment, so the payment is the door, and this is where it is found.
  const payment = shared.section?.settlements.find((one) => one.id === row?.sharedSettlementId);
  const paymentGroups = lookups.shared?.payments.get(row?.sharedSettlementId ?? "")?.groups ?? [];

  async function confirmUndo(settlementId: string) {
    try {
      await undoPayment.mutateAsync(settlementId);
      toast.show({ message: t("shared.undoPayment.done") });
      router.push("/transactions");
    } catch (error) {
      setUndoing(false);
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  async function forgive(groupId: string, person: PartyView) {
    try {
      await writeOff.mutateAsync({
        groupId,
        contactId: person.contactId,
        expenseId: person.expenseId,
        amount: person.owesYou,
      });
      toast.show({ message: t("shared.writeOff.done", { name: person.name }) });
    } catch (error) {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(id);
      toast.show({ message: t("transactions.form.deleted") });
      router.push("/transactions");
    } catch (error) {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
      setConfirming(false);
    }
  }

  const category = row ? lookups.categories.get(row.categoryId ?? "") : undefined;
  const from = row ? lookups.accounts.get(row.fromAccountId ?? "") : undefined;
  const to = row ? lookups.accounts.get(row.toAccountId ?? "") : undefined;
  const unknownAccount = t("transactions.detail.unknownAccount");

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={t("transactions.detail.title")}
        onBack={() => {
          back("/transactions");
        }}
      />
      {transaction.isPending ? (
        <div
          className="flex flex-col gap-4"
          role="status"
          aria-busy="true"
          aria-label={t("common.loading")}
        >
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : transaction.isError || !row ? (
        <Empty
          tone={notFound ? "neutral" : "danger"}
          icon={<CircleAlert {...iconProps("lg")} />}
          title={notFound ? t("transactions.form.notFound") : t("states.error.title")}
          body={notFound ? undefined : <LoadErrorBody error={transaction.error} />}
          action={
            notFound ? (
              <Link href="/transactions" className={buttonClasses({ variant: "secondary" })}>
                {t("common.backToList")}
              </Link>
            ) : (
              <Button
                onClick={() => {
                  void transaction.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      ) : (
        <>
          {stuck !== null && (
            <Alert tone="danger" title={t("states.conflicts.title")}>
              <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
                <span>
                  {t("states.attention.onRow", { what: t("states.conflict.entities.transaction") })}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setResolving(true);
                  }}
                >
                  {t("states.conflicts.review")}
                </Button>
              </span>
            </Alert>
          )}
          {row.pendingDetails && (
            <Alert tone="warning">
              <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
                <span>{t("transactions.detail.pendingBody")}</span>
                <Link
                  href={{ pathname: "/transactions/review", query: { focus: row.id } }}
                  className={buttonClasses({ size: "sm", variant: "secondary" })}
                >
                  {t("transactions.detail.complete")}
                </Link>
              </span>
            </Alert>
          )}
          <Card className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            {category ? (
              <Tile size="lg" color={category.color}>
                <CategoryIcon icon={category.icon} size="lg" />
              </Tile>
            ) : (
              <Tile
                size="lg"
                color={row.type === "TRANSFER" || row.type === "SETTLEMENT" ? "GRAY" : null}
                className="bg-surface-2 text-text-2"
              >
                {row.type === "ADJUSTMENT" ? (
                  <Scale {...iconProps("lg")} />
                ) : row.type === "SETTLEMENT" ? (
                  <HandCoins {...iconProps("lg")} />
                ) : row.type === "TRANSFER" ? (
                  <Repeat {...iconProps("lg")} />
                ) : (
                  <Hash {...iconProps("lg")} />
                )}
              </Tile>
            )}
            <Amount value={row.amount} kind={amountKind(row)} size="hero" className="text-[36px]" />
            <h2 className="text-md font-semibold">{transactionTitle(row, lookups, t)}</h2>
            <span className="text-sm text-text-3">
              {[t(`transactionTypes.${row.type}`), (from ?? to)?.name].filter(Boolean).join(" · ")}
            </span>
            {/* Which outing it settled: the row in the list says it too, and the hero is where it is read. */}
            {paymentGroups.length > 0 && (
              <Badge>
                <HandCoins aria-hidden="true" />
                {paymentGroups.join(" · ")}
              </Badge>
            )}
          </Card>
          <Card className="px-4 py-1">
            {category && (
              <Attribute label={t("transactions.detail.category")}>
                <span className="inline-flex items-center gap-2">
                  <Tile size="sm" color={category.color}>
                    <CategoryIcon icon={category.icon} size="sm" />
                  </Tile>
                  {category.name}
                </span>
              </Attribute>
            )}
            {row.type === "TRANSFER" ? (
              <>
                <Attribute label={t("transactions.detail.from")}>
                  <AccountValue account={from} fallback={unknownAccount} />
                </Attribute>
                <Attribute label={t("transactions.detail.to")}>
                  <AccountValue account={to} fallback={unknownAccount} />
                </Attribute>
              </>
            ) : (
              <Attribute label={t("transactions.detail.account")}>
                <AccountValue account={from ?? to} fallback={unknownAccount} />
              </Attribute>
            )}
            {row.type === "ADJUSTMENT" && (
              <Attribute label={t("transactions.form.direction")}>
                {row.toAccountId
                  ? t("transactions.form.increase")
                  : t("transactions.form.decrease")}
              </Attribute>
            )}
            <Attribute label={t("common.date")}>
              {t("transactions.detail.dateTime", {
                date: dates.formatLong(new Date(row.date)),
                time: dates.formatTime(new Date(row.date)),
              })}
            </Attribute>
            {row.tags.length > 0 && (
              <Attribute label={t("transactions.form.tags")}>
                <span className="inline-flex flex-wrap justify-end gap-1">
                  {row.tags.map((tag) => (
                    <Tag key={tag} label={tag} />
                  ))}
                </span>
              </Attribute>
            )}
            {row.note && (
              <Attribute label={t("transactions.form.note")}>
                <span className="whitespace-pre-wrap">{row.note}</span>
              </Attribute>
            )}
            <Attribute label={t("transactions.detail.source")}>
              <Badge tone={row.source === "QUICK" ? "warning" : "neutral"}>
                {t(`transactions.detail.sources.${row.source}`)}
              </Badge>
            </Attribute>
            {group && (
              <Attribute label={t("transactions.detail.shared.group")}>
                <Link
                  href={`/shared/groups/${group.group.id}`}
                  className="text-brand-text underline-offset-2 hover:underline"
                >
                  {group.group.name}
                </Link>
              </Attribute>
            )}
            <Attribute label={t("transactions.detail.currency")}>{row.currency}</Attribute>
          </Card>
          {shared.isError && (row.sharedExpenseId !== null || row.sharedSettlementId !== null) && (
            <Alert
              tone="danger"
              title={t(
                row.sharedExpenseId !== null
                  ? "transactions.detail.shared.unreadable"
                  : "transactions.detail.shared.paymentUnreadable",
              )}
            >
              <LoadErrorBody error={shared.error} />
            </Alert>
          )}
          {shared.section && group && expense && (
            <SharedExpenseCard
              row={row}
              section={shared.section}
              view={group}
              expense={expense}
              categoryName={category?.name}
            />
          )}
          {/* Decision 4: splitting a loose expense creates a shared group of one. */}
          {row.type === "EXPENSE" && row.sharedExpenseId === null && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setSplitting(true);
              }}
            >
              <Split {...iconProps("sm")} />
              {t("transactions.detail.split")}
            </Button>
          )}
          {/* Its money belongs to the payment, and the payment is the only door to it. */}
          {row.type === "SETTLEMENT" ? (
            <div className="flex flex-col gap-3">
              <Alert tone="neutral">{t("transactions.detail.settlementLocked")}</Alert>
              {/* While it is coming the door says so; it is never a button that cannot work. */}
              {(payment !== undefined || shared.isPending) && (
                <Button
                  variant="danger"
                  size="lg"
                  block
                  loading={shared.isPending}
                  onClick={() => {
                    setUndoing(true);
                  }}
                >
                  <Undo2 {...iconProps("sm")} />
                  {t("shared.undoPayment.action")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {row.type === "ADJUSTMENT" ? (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    adjustment.opened(row);
                  }}
                >
                  <Pencil {...iconProps("sm")} />
                  {t("transactions.detail.edit")}
                </Button>
              ) : (
                <Link
                  href={`/transactions/${row.id}/edit`}
                  className={buttonClasses({ variant: "secondary", size: "lg" })}
                >
                  <Pencil {...iconProps("sm")} />
                  {t("transactions.detail.edit")}
                </Link>
              )}
              <Button
                variant="danger"
                size="lg"
                onClick={() => {
                  setConfirming(true);
                }}
              >
                <Trash2 {...iconProps("sm")} />
                {t("common.delete")}
              </Button>
            </div>
          )}
          <p className="text-center text-xs text-text-3">
            {row.updatedAt !== row.createdAt
              ? t("transactions.detail.createdEdited", {
                  created: dates.formatDay(new Date(row.createdAt)),
                  edited: dates.formatDay(new Date(row.updatedAt)),
                })
              : t("transactions.detail.created", {
                  created: dates.formatDay(new Date(row.createdAt)),
                })}
          </p>
        </>
      )}
      {undoing && payment && (
        <UndoPaymentSheet
          open
          settlement={payment}
          name={lookups.shared?.payments.get(payment.id)?.name ?? ""}
          pending={undoPayment.isPending}
          onClose={() => {
            setUndoing(false);
          }}
          onConfirm={() => {
            void confirmUndo(payment.id);
          }}
        />
      )}
      {/* Mounted only while it is open: its title carries the movement's own description. */}
      {row && splitting && (
        <SplitThisSheet
          open
          transaction={row}
          onClose={() => {
            setSplitting(false);
          }}
          onDone={(groupId) => {
            router.push(`/shared/groups/${groupId}`);
          }}
        />
      )}
      <DeleteTransactionSheet
        open={confirming}
        pending={remove.isPending}
        shared={
          shared.section && group && expense && row
            ? {
                groupName: group.group.name,
                accountName: (from ?? to)?.name ?? unknownAccount,
                amount: row.amount,
                ...deleteImpact(shared.section, group, expense),
              }
            : undefined
        }
        onWriteOff={
          // Only when one person is left owing is "write it off" a single, unambiguous act.
          onlyDebtor && group
            ? () => {
                setConfirming(false);
                void forgive(group.group.id, onlyDebtor);
              }
            : undefined
        }
        onConfirm={() => {
          void confirmDelete();
        }}
        onClose={() => {
          setConfirming(false);
        }}
      />
      {adjustment.sheet}
      <SyncConflictSheet
        open={resolving}
        seq={stuck}
        onClose={() => {
          setResolving(false);
        }}
      />
    </div>
  );
}
