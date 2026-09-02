"use client";

import { Archive, ArchiveRestore, CircleAlert, Inbox, Pencil, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { AccountHero } from "@/features/accounts/components/AccountHero";
import {
  ArchiveAccountSheet,
  MakeMainSheet,
  RestoreConflictSheet,
} from "@/features/accounts/components/AccountSheets";
import {
  useAccountQuery,
  useAccountsQuery,
  useArchiveAccount,
  useRestoreAccount,
  useSetDefaultAccount,
} from "@/features/accounts/hooks";
import { findActiveByName } from "@/features/accounts/summary";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { TransactionDayList } from "@/features/transactions/components/TransactionDayList";
import type { TransactionLookups } from "@/features/transactions/components/TransactionRow";
import { useTransactionsInfinite } from "@/features/transactions/hooks";
import { ApiError, presentError } from "@/lib/api/errors";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

type OpenSheet = "main" | "archive" | "conflict" | null;

export function AccountDetailScreen({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const account = useAccountQuery(id);
  const accounts = useAccountsQuery(true);
  const categories = useCategoriesQuery();
  const transactions = useTransactionsInfinite({ accountId: id }, account.isSuccess);
  const setDefault = useSetDefaultAccount();
  const archive = useArchiveAccount();
  const restore = useRestoreAccount();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const notFound = account.error instanceof ApiError && account.error.status === 404;
  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((row) => [row.id, row])),
      categories: new Map((categories.data ?? []).map((row) => [row.id, row])),
    }),
    [accounts.data, categories.data],
  );
  const row = account.data;
  const previousMain = accounts.data?.find((other) => other.isDefault && other.id !== id);
  const conflict = row ? findActiveByName(accounts.data ?? [], row.name) : undefined;
  const rows = transactions.data?.pages.flatMap((page) => page.data) ?? [];

  function fail(error: unknown) {
    toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
  }

  async function confirmMain() {
    if (!row) return;
    try {
      await setDefault.mutateAsync(id);
      setSheet(null);
      toast.show({
        message: t("accounts.main.done", { name: row.name }),
        action: previousMain
          ? {
              label: t("common.undo"),
              onClick: () => {
                setDefault
                  .mutateAsync(previousMain.id)
                  .then(() => {
                    toast.show({
                      message: t("accounts.main.undone", { name: previousMain.name }),
                    });
                  })
                  .catch(fail);
              },
            }
          : undefined,
      });
    } catch (error) {
      setSheet(null);
      fail(error);
    }
  }

  async function confirmArchive() {
    try {
      await archive.mutateAsync(id);
      setSheet(null);
      toast.show({
        message: t("accounts.archive.done"),
        action: {
          label: t("common.undo"),
          onClick: () => {
            restore
              .mutateAsync(id)
              .then(() => {
                toast.show({ message: t("accounts.archive.restored") });
              })
              .catch(fail);
          },
        },
      });
    } catch (error) {
      setSheet(null);
      fail(error);
    }
  }

  async function restoreAccount() {
    try {
      await restore.mutateAsync(id);
      toast.show({ message: t("accounts.archive.restored") });
    } catch (error) {
      if (error instanceof ApiError && error.code === "DUPLICATE") {
        // The cached list may predate the account that took the name: refresh it before naming the culprit.
        await accounts.refetch();
        setSheet("conflict");
      } else fail(error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={row?.name ?? t("accounts.detail.title")}
        onBack={() => {
          router.back();
        }}
      />
      {account.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-44 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : account.isError || !row ? (
        <Empty
          tone={notFound ? "neutral" : "danger"}
          icon={<CircleAlert {...iconProps("lg")} />}
          title={notFound ? t("accounts.detail.notFound") : t("states.error.title")}
          body={notFound ? undefined : t("states.error.body")}
          action={
            notFound ? (
              <Link href="/accounts" className={buttonClasses({ variant: "secondary" })}>
                {t("common.backToList")}
              </Link>
            ) : (
              <Button
                onClick={() => {
                  void account.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <AccountHero account={row} />
          <div className="grid grid-cols-2 gap-3">
            {row.archivedAt ? (
              <Button
                size="lg"
                loading={restore.isPending}
                onClick={() => {
                  void restoreAccount();
                }}
              >
                <ArchiveRestore {...iconProps("sm")} />
                {t("accounts.detail.restore")}
              </Button>
            ) : (
              <Link
                href={`/accounts/${row.id}/edit`}
                className={buttonClasses({ variant: "secondary", size: "lg" })}
              >
                <Pencil {...iconProps("sm")} />
                {t("accounts.detail.edit")}
              </Link>
            )}
            <Button
              variant="secondary"
              size="lg"
              disabled={row.isDefault || Boolean(row.archivedAt)}
              onClick={() => {
                setSheet("main");
              }}
            >
              <Star {...iconProps("sm")} />
              {t("accounts.detail.makeMain")}
            </Button>
            {!row.archivedAt && (
              <Button
                variant="secondary"
                size="lg"
                disabled={row.isDefault}
                onClick={() => {
                  setSheet("archive");
                }}
              >
                <Archive {...iconProps("sm")} />
                {t("accounts.detail.archive")}
              </Button>
            )}
          </div>
          {row.isDefault && <Alert tone="neutral">{t("accounts.detail.mainBlocked")}</Alert>}
          {row.archivedAt && <Alert tone="neutral">{t("accounts.detail.archivedInfo")}</Alert>}
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-md font-semibold">{t("accounts.detail.transactions")}</h2>
              <Link
                href={{ pathname: "/transactions", query: { account: row.id, period: "all" } }}
                className="text-sm font-medium text-brand-text"
              >
                {t("accounts.detail.openFiltered")}
              </Link>
            </div>
            {transactions.isPending ? (
              <Card flush aria-busy="true" aria-label={t("common.loading")}>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </Card>
            ) : transactions.isError ? (
              <Card>
                <Empty
                  tone="danger"
                  icon={<CircleAlert {...iconProps("lg")} />}
                  title={t("states.error.title")}
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void transactions.refetch();
                      }}
                    >
                      {t("common.retry")}
                    </Button>
                  }
                />
              </Card>
            ) : rows.length === 0 ? (
              <Card>
                <Empty
                  icon={<Inbox {...iconProps("lg")} />}
                  title={t("accounts.detail.noTransactions")}
                />
              </Card>
            ) : (
              <>
                <TransactionDayList
                  transactions={rows}
                  lookups={lookups}
                  onOpen={(transaction) => {
                    router.push(`/transactions/${transaction.id}`);
                  }}
                />
                {transactions.hasNextPage && (
                  <Button
                    variant="secondary"
                    block
                    loading={transactions.isFetchingNextPage}
                    onClick={() => {
                      void transactions.fetchNextPage();
                    }}
                  >
                    {t("transactions.list.loadMore")}
                  </Button>
                )}
              </>
            )}
          </section>
          <MakeMainSheet
            account={row}
            previous={previousMain}
            open={sheet === "main"}
            pending={setDefault.isPending}
            onConfirm={() => {
              void confirmMain();
            }}
            onClose={() => {
              setSheet(null);
            }}
          />
          <ArchiveAccountSheet
            account={row}
            open={sheet === "archive"}
            pending={archive.isPending}
            onConfirm={() => {
              void confirmArchive();
            }}
            onClose={() => {
              setSheet(null);
            }}
          />
          <RestoreConflictSheet
            account={row}
            conflict={conflict}
            open={sheet === "conflict"}
            onClose={() => {
              setSheet(null);
            }}
          />
        </>
      )}
    </div>
  );
}
