"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery, useRecentCategories } from "@/features/categories/hooks";
import type { TransactionLookups } from "@/features/transactions/components/TransactionRow";
import {
  useBatchComplete,
  usePendingSummary,
  useTransactionsInfinite,
} from "@/features/transactions/hooks";
import { ERROR_TABLE, type ErrorMessageKey, isErrorCode, presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import { useBackNavigation } from "@/lib/navigation/history";
import type { Transaction } from "@/types/api";

import { ReviewCard, type ReviewDraft } from "./ReviewCard";

const PENDING_QUERY = { pendingDetails: "true" } as const;

function draftOf(transaction: Transaction, drafts: Record<string, ReviewDraft>): ReviewDraft {
  return (
    drafts[transaction.id] ?? {
      categoryId: transaction.categoryId,
      description: transaction.description ?? "",
    }
  );
}

export function ReviewScreen() {
  const t = useTranslations();
  const back = useBackNavigation();
  const toast = useToast();
  const params = useSearchParams();
  const focus = params.get("focus");
  const list = useTransactionsInfinite(PENDING_QUERY);
  const summary = usePendingSummary();
  const accounts = useAccountsQuery(true);
  const categories = useCategoriesQuery("EXPENSE");
  const allCategories = useCategoriesQuery(undefined);
  const recent = useRecentCategories("EXPENSE", categories.data, 4);
  const batch = useBatchComplete();
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [failures, setFailures] = useState<Record<string, ErrorMessageKey>>({});
  const [confirming, setConfirming] = useState(false);
  const keyring = useRef(new IdempotencyKeyring());
  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((account) => [account.id, account])),
      categories: new Map((allCategories.data ?? []).map((category) => [category.id, category])),
    }),
    [accounts.data, allCategories.data],
  );
  const rows = list.data?.pages.flatMap((page) => page.data) ?? [];
  const total = summary.data?.count ?? list.data?.pages[0]?.pagination.total ?? 0;
  const ready = rows.filter((row) => draftOf(row, drafts).categoryId !== null);
  const skipped = rows.length - ready.length;

  async function saveAll() {
    const input = {
      items: ready.map((row) => {
        const draft = draftOf(row, drafts);
        return {
          id: row.id,
          categoryId: draft.categoryId,
          description: draft.description.trim() || null,
          pendingDetails: false,
        };
      }),
    };
    try {
      const result = await batch.mutateAsync({
        input,
        idempotencyKey: keyring.current.keyFor(input),
      });
      setConfirming(false);
      setFailures(
        Object.fromEntries(
          result.failed.map((failure) => [
            failure.id,
            isErrorCode(failure.code) ? ERROR_TABLE[failure.code].messageKey : "errors.UNKNOWN",
          ]),
        ),
      );
      const updatedIds = new Set(result.updated.map((updated) => updated.id));
      setDrafts((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => !updatedIds.has(id))),
      );
      toast.show(
        result.failed.length === 0
          ? { message: t("transactions.review.batchSaved", { count: result.updated.length }) }
          : {
              message: t("transactions.review.batchPartial", {
                saved: result.updated.length,
                failed: result.failed.length,
              }),
              tone: "danger",
            },
      );
    } catch (error) {
      setConfirming(false);
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={
          total > 0
            ? t("transactions.review.titleCount", { count: total })
            : t("transactions.review.title")
        }
        onBack={() => {
          back("/transactions");
        }}
        actions={
          summary.data && summary.data.total > 0 ? (
            <Amount value={summary.data.total} signed={false} size="sm" className="text-text-3" />
          ) : undefined
        }
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
          body={<LoadErrorBody error={list.error} />}
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
              draft={draftOf(transaction, drafts)}
              onDraftChange={(draft) => {
                setDrafts((current) => ({ ...current, [transaction.id]: draft }));
                setFailures((current) =>
                  transaction.id in current
                    ? Object.fromEntries(
                        Object.entries(current).filter(([id]) => id !== transaction.id),
                      )
                    : current,
                );
              }}
              lookups={lookups}
              recent={recent}
              focused={transaction.id === focus}
              errorKey={failures[transaction.id] ?? null}
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
          {ready.length > 0 && (
            <div className="sticky bottom-4 z-10">
              <Button
                size="lg"
                block
                className="shadow-3"
                onClick={() => {
                  setConfirming(true);
                }}
              >
                {t("transactions.review.saveAll", { count: ready.length })}
              </Button>
            </div>
          )}
        </>
      )}
      <Sheet
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title={t("transactions.review.confirmTitle", { count: ready.length })}
        footer={
          <>
            <Button
              size="lg"
              block
              loading={batch.isPending}
              onClick={() => {
                void saveAll();
              }}
            >
              {t("transactions.review.confirmCta", { count: ready.length })}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              block
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t("common.cancel")}
            </Button>
          </>
        }
      >
        <Alert tone="warning">
          {t("transactions.review.confirmBody")}
          {skipped > 0 && ` ${t("transactions.review.confirmSkipped", { count: skipped })}`}
        </Alert>
      </Sheet>
    </div>
  );
}
