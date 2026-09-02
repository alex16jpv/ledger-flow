"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery, useRecentCategories } from "@/features/categories/hooks";
import type { TransactionLookups } from "@/features/transactions/components/TransactionRow";
import { useTransactionsInfinite } from "@/features/transactions/hooks";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

import { ReviewCard } from "./ReviewCard";

const PENDING_QUERY = { pendingDetails: "true" } as const;

export function ReviewScreen() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const focus = params.get("focus");
  const list = useTransactionsInfinite(PENDING_QUERY);
  const accounts = useAccountsQuery(true);
  const categories = useCategoriesQuery("EXPENSE");
  const allCategories = useCategoriesQuery(undefined);
  const recent = useRecentCategories("EXPENSE", categories.data, 4);
  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((account) => [account.id, account])),
      categories: new Map((allCategories.data ?? []).map((category) => [category.id, category])),
    }),
    [accounts.data, allCategories.data],
  );
  const rows = list.data?.pages.flatMap((page) => page.data) ?? [];
  const total = list.data?.pages[0]?.pagination.total ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={
          total > 0
            ? t("transactions.review.titleCount", { count: total })
            : t("transactions.review.title")
        }
        onBack={() => {
          router.back();
        }}
      />
      {list.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
      ) : list.isError ? (
        <Empty
          tone="danger"
          icon={<CircleAlert {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={t("states.error.body")}
          action={
            <Button
              onClick={() => {
                void list.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <Empty
          icon={<CheckCircle2 {...iconProps("lg")} />}
          title={t("transactions.review.empty.title")}
          body={t("transactions.review.empty.body")}
          action={
            <Link href="/home" className={buttonClasses({})}>
              {t("transactions.review.empty.cta")}
            </Link>
          }
        />
      ) : (
        <>
          <Alert tone="neutral">{t("transactions.review.intro")}</Alert>
          {rows.map((transaction) => (
            <ReviewCard
              key={transaction.id}
              transaction={transaction}
              lookups={lookups}
              recent={recent}
              focused={transaction.id === focus}
            />
          ))}
          {list.hasNextPage && (
            <Button
              variant="secondary"
              block
              loading={list.isFetchingNextPage}
              onClick={() => {
                void list.fetchNextPage();
              }}
            >
              {t("transactions.list.loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
