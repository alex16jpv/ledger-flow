"use client";

import { CircleAlert, Hash, Pencil, Repeat, Scale, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, type ReactNode, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
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
import { useBackNavigation } from "@/lib/navigation/history";
import type { Account } from "@/types/api";

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
  const [confirming, setConfirming] = useState(false);
  const notFound = transaction.error instanceof ApiError && transaction.error.status === 404;
  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((account) => [account.id, account])),
      categories: new Map((categories.data ?? []).map((category) => [category.id, category])),
    }),
    [accounts.data, categories.data],
  );

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

  const row = transaction.data;
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
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
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
                color={row.type === "TRANSFER" ? "GRAY" : null}
                className="bg-surface-2 text-text-2"
              >
                {row.type === "ADJUSTMENT" ? (
                  <Scale {...iconProps("lg")} />
                ) : row.type === "TRANSFER" ? (
                  <Repeat {...iconProps("lg")} />
                ) : (
                  <Hash {...iconProps("lg")} />
                )}
              </Tile>
            )}
            <Amount
              value={row.amount}
              kind={amountKind(row.type)}
              size="hero"
              className="text-[36px]"
            />
            <h2 className="text-md font-semibold">{transactionTitle(row, lookups, t)}</h2>
            <span className="text-sm text-text-3">
              {[t(`transactionTypes.${row.type}`), (from ?? to)?.name].filter(Boolean).join(" · ")}
            </span>
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
            <Attribute label={t("transactions.detail.currency")}>{row.currency}</Attribute>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/transactions/${row.id}/edit`}
              className={buttonClasses({ variant: "secondary", size: "lg" })}
            >
              <Pencil {...iconProps("sm")} />
              {t("transactions.detail.edit")}
            </Link>
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
      <DeleteTransactionSheet
        open={confirming}
        pending={remove.isPending}
        onConfirm={() => {
          void confirmDelete();
        }}
        onClose={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}
