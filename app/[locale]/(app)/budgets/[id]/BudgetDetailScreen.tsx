"use client";

import { Archive, ArchiveRestore, ChartPie, CircleAlert, Inbox, Pencil } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CategoryChip, ChipRow } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { BudgetHero } from "@/features/budgets/components/BudgetHero";
import {
  ArchiveBudgetSheet,
  OverrideSheet,
  RestoreBudgetConflictSheet,
} from "@/features/budgets/components/BudgetSheets";
import { budgetIcon } from "@/features/budgets/components/BudgetsView";
import { PeriodAmountCard } from "@/features/budgets/components/PeriodAmountCard";
import {
  useArchiveBudget,
  useBudgetQuery,
  useBudgetsQuery,
  useRemoveBudgetOverride,
  useRestoreBudget,
  useSetBudgetOverride,
} from "@/features/budgets/hooks";
import { findOverlapping, isGlobalBudget } from "@/features/budgets/progress";
import {
  currentMonthKey,
  monthReference,
  parseMonthKey,
  shiftMonthKey,
} from "@/features/budgets/reference";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { TransactionDayList } from "@/features/transactions/components/TransactionDayList";
import type { TransactionLookups } from "@/features/transactions/components/TransactionRow";
import { useTransactionsInfinite } from "@/features/transactions/hooks";
import { ApiError, presentError } from "@/lib/api/errors";
import { dayKey } from "@/lib/format/dates";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Budget } from "@/types/api";

type OpenSheet = "override" | "archive" | "conflict" | null;
const PREVIEW_ROWS = 5;

function periodLabelFor(budget: Budget, formatMonth: (d: Date) => string, range: string) {
  return budget.periodType === "MONTHLY" ? formatMonth(new Date(budget.periodFrom)) : range;
}

export function BudgetDetailScreen({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const dates = useDates();
  const params = useSearchParams();
  const [now] = useState(() => new Date());
  const monthKey = parseMonthKey(params.get("reference"), now, dates.timeZone);
  const { reference, iso } = monthReference(monthKey, dates.timeZone, now);
  const budget = useBudgetQuery(id, iso);
  const categories = useCategoriesQuery(undefined, true, true);
  const accounts = useAccountsQuery(true);
  const setOverride = useSetBudgetOverride(id);
  const removeOverride = useRemoveBudgetOverride(id);
  const archive = useArchiveBudget();
  const restore = useRestoreBudget();
  const activeBudgets = useBudgetsQuery({ reference: iso }, Boolean(budget.data?.archivedAt));
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const row = budget.data;
  const notFound = budget.error instanceof ApiError && budget.error.status === 404;
  const categoryMap = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );
  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((account) => [account.id, account])),
      categories: categoryMap,
    }),
    [accounts.data, categoryMap],
  );
  const single = row?.categoryIds.length === 1 ? row.categoryIds[0] : undefined;
  const transactions = useTransactionsInfinite(
    row
      ? {
          from: row.periodFrom,
          to: row.periodTo,
          type: row.type,
          categoryId: single,
        }
      : {},
    Boolean(row),
  );
  const rows = useMemo(() => {
    const all = transactions.data?.pages.flatMap((page) => page.data) ?? [];
    const ids = new Set(row?.categoryIds ?? []);
    return (row && ids.size > 1 ? all.filter((item) => ids.has(item.categoryId ?? "")) : all).slice(
      0,
      PREVIEW_ROWS,
    );
  }, [transactions.data, row]);

  function navigate(nextKey: string) {
    router.replace({ pathname: `/budgets/${id}`, query: { reference: nextKey } });
  }

  function fail(error: unknown) {
    toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
  }

  async function override(amount: number, message: string) {
    try {
      await setOverride.mutateAsync({ reference: iso, amount });
      setSheet(null);
      toast.show({ message });
    } catch (error) {
      setSheet(null);
      fail(error);
    }
  }

  async function restoreBudget() {
    try {
      await restore.mutateAsync({ id, reference: iso });
      toast.show({ message: t("budgets.detail.restored") });
    } catch (error) {
      if (error instanceof ApiError && error.code === "BUDGET_PERIOD_OVERLAP") setSheet("conflict");
      else fail(error);
    }
  }

  async function confirmArchive() {
    try {
      await archive.mutateAsync(id);
      toast.show({
        message: t("budgets.detail.archived"),
        action: {
          label: t("common.undo"),
          onClick: () => {
            void restoreBudget();
          },
        },
      });
      router.push("/budgets");
    } catch (error) {
      setSheet(null);
      fail(error);
    }
  }

  const range = row
    ? dates.formatRange(new Date(row.periodFrom), new Date(new Date(row.periodTo).getTime() - 1))
    : "";
  const periodLabel = row ? periodLabelFor(row, dates.formatMonth, range) : "";
  const seeAllHref = row
    ? {
        pathname: "/transactions" as const,
        query: {
          period: "custom",
          from: dayKey(new Date(row.periodFrom), dates.timeZone),
          to: dayKey(new Date(new Date(row.periodTo).getTime() - 1), dates.timeZone),
          type: row.type,
          ...(single ? { category: single } : {}),
        },
      }
    : null;
  const writable = row && !row.archivedAt && !row.expired;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={t("budgets.detail.title")}
        onBack={() => {
          router.back();
        }}
      />
      <PeriodNav
        label={dates.formatMonth(reference)}
        previousLabel={t("budgets.list.previousMonth")}
        nextLabel={t("budgets.list.nextMonth")}
        nextDisabled={monthKey >= currentMonthKey(now, dates.timeZone)}
        onPrevious={() => {
          navigate(shiftMonthKey(monthKey, -1, dates.timeZone));
        }}
        onNext={() => {
          navigate(shiftMonthKey(monthKey, 1, dates.timeZone));
        }}
      />
      {budget.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : budget.isError || !row ? (
        <Empty
          tone={notFound ? "neutral" : "danger"}
          icon={<CircleAlert {...iconProps("lg")} />}
          title={notFound ? t("budgets.detail.notFound") : t("states.error.title")}
          body={notFound ? undefined : t("states.error.body")}
          action={
            notFound ? (
              <Link href="/budgets" className={buttonClasses({ variant: "secondary" })}>
                {t("common.backToList")}
              </Link>
            ) : (
              <Button
                onClick={() => {
                  void budget.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <BudgetHero budget={row} icon={budgetIcon(row, categoryMap)} now={now} />
          {row.archivedAt && (
            <>
              <Alert tone="neutral">{t("budgets.detail.archivedInfo")}</Alert>
              <Button
                size="lg"
                block
                loading={restore.isPending}
                onClick={() => {
                  void restoreBudget();
                }}
              >
                <ArchiveRestore {...iconProps("sm")} />
                {t("budgets.detail.restore")}
              </Button>
              {sheet === "conflict" && (
                <RestoreBudgetConflictSheet
                  budget={row}
                  conflict={findOverlapping(row, activeBudgets.data ?? [])}
                  open
                  onClose={() => {
                    setSheet(null);
                  }}
                />
              )}
            </>
          )}
          {!row.archivedAt && row.expired && (
            <Alert tone="neutral">
              {t("budgets.detail.endedInfo", {
                date: dates.formatDay(new Date(new Date(row.periodTo).getTime() - 1)),
              })}
            </Alert>
          )}
          {writable && (
            <PeriodAmountCard
              budget={row}
              periodLabel={periodLabel}
              pending={setOverride.isPending || removeOverride.isPending}
              onChange={() => {
                setSheet("override");
              }}
              onSkip={() => {
                void override(0, t("budgets.detail.skippedToast"));
              }}
              onRemove={() => {
                removeOverride
                  .mutateAsync({ reference: iso })
                  .then(() => {
                    toast.show({ message: t("budgets.detail.overrideRemoved") });
                  })
                  .catch(fail);
              }}
            />
          )}
          <Card className="flex flex-col gap-3">
            <h2 className="text-md font-semibold">{t("budgets.detail.categories")}</h2>
            <ChipRow className="flex-wrap overflow-visible">
              {isGlobalBudget(row) ? (
                <CategoryChip color={row.color} icon={<ChartPie aria-hidden="true" />} disabled>
                  {t("budgets.detail.allSpending")}
                </CategoryChip>
              ) : (
                row.categoryIds.map((categoryId) => {
                  const category = categoryMap.get(categoryId);
                  const archived = row.archivedCategoryIds.includes(categoryId);
                  return (
                    <CategoryChip
                      key={categoryId}
                      color={category?.color ?? row.color}
                      icon={<CategoryIcon icon={category?.icon} size="sm" />}
                      disabled
                      className={cn(archived && "opacity-70")}
                    >
                      {category?.name ?? t("transactions.detail.unknownAccount")}
                      {archived && <Badge tone="warning">{t("budgets.detail.archivedChip")}</Badge>}
                    </CategoryChip>
                  );
                })
              )}
            </ChipRow>
          </Card>
          {row.note && (
            <Card className="flex flex-col gap-1">
              <h2 className="text-md font-semibold">{t("budgets.detail.note")}</h2>
              <p className="text-sm text-text-2">{row.note}</p>
            </Card>
          )}
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-md font-semibold">{t("budgets.detail.transactions")}</h2>
              {seeAllHref && (
                <Link href={seeAllHref} className="text-sm font-medium text-brand-text">
                  {t("budgets.detail.seeAll")}
                </Link>
              )}
            </div>
            {transactions.isPending ? (
              <Card flush aria-busy="true" aria-label={t("common.loading")}>
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
                  title={t("budgets.detail.noTransactions")}
                />
              </Card>
            ) : (
              <TransactionDayList
                transactions={rows}
                lookups={lookups}
                onOpen={(transaction) => {
                  router.push(`/transactions/${transaction.id}`);
                }}
              />
            )}
          </section>
          {!row.archivedAt && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/budgets/${row.id}/edit`}
                  className={buttonClasses({ variant: "secondary", size: "lg" })}
                >
                  <Pencil {...iconProps("sm")} />
                  {t("budgets.detail.edit")}
                </Link>
                <Button
                  variant="danger"
                  size="lg"
                  onClick={() => {
                    setSheet("archive");
                  }}
                >
                  <Archive {...iconProps("sm")} />
                  {t("budgets.detail.archive")}
                </Button>
              </div>
              <p className="text-center text-xs text-text-3">{t("budgets.detail.archiveNote")}</p>
            </div>
          )}
          {sheet === "override" && (
            <OverrideSheet
              budget={row}
              periodLabel={periodLabel}
              open
              pending={setOverride.isPending}
              onConfirm={(amount) => {
                void override(amount, t("budgets.detail.overrideSaved"));
              }}
              onClose={() => {
                setSheet(null);
              }}
            />
          )}
          <ArchiveBudgetSheet
            budget={row}
            open={sheet === "archive"}
            pending={archive.isPending}
            onConfirm={() => {
              void confirmArchive();
            }}
            onClose={() => {
              setSheet(null);
            }}
          />
        </>
      )}
    </div>
  );
}
