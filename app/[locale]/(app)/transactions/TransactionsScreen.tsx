"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, Inbox, Search, SlidersHorizontal, WifiOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { ADD_HREF } from "@/components/shell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Empty } from "@/components/ui/Empty";
import { Input } from "@/components/ui/Field";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { PeriodSummary } from "@/features/transactions/components/PeriodSummary";
import { TransactionDayList } from "@/features/transactions/components/TransactionDayList";
import type { TransactionLookups } from "@/features/transactions/components/TransactionRow";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  matchesSearch,
  parseFilters,
  periodWindow,
  serializeFilters,
  toListQuery,
  type TransactionFilters,
} from "@/features/transactions/filters";
import {
  usePendingCount,
  usePeriodTotals,
  useTransactionsInfinite,
} from "@/features/transactions/hooks";
import { transactionKeys } from "@/features/transactions/keys";
import { ApiError } from "@/lib/api/errors";
import { isEnabled } from "@/lib/flags";
import { toIsoWindow } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";

import { FiltersSheet } from "./FiltersSheet";

const SEARCH_DEBOUNCE_MS = 300;

export function TransactionsScreen() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const dates = useDates();
  const { timeZone } = useFormatSettings();
  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const query = useMemo(() => toListQuery(filters, timeZone), [filters, timeZone]);
  const window = useMemo(() => periodWindow(filters, timeZone), [filters, timeZone]);
  const list = useTransactionsInfinite(query);
  const totals = usePeriodTotals(window ? toIsoWindow(window) : null);
  const pendingCount = usePendingCount();
  const accounts = useAccountsQuery(true);
  const categories = useCategoriesQuery();
  const [search, setSearch] = useState(filters.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((account) => [account.id, account])),
      categories: new Map((categories.data ?? []).map((category) => [category.id, category])),
    }),
    [accounts.data, categories.data],
  );

  function apply(next: TransactionFilters) {
    router.replace({
      pathname: "/transactions",
      query: Object.fromEntries(serializeFilters(next)),
    });
  }

  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => {
      apply({ ...filters, q: search });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply only depends on the router
  }, [search]);

  const invalidCursor = list.error instanceof ApiError && list.error.code === "INVALID_CURSOR";
  useEffect(() => {
    if (!invalidCursor) return;
    void queryClient.resetQueries({ queryKey: transactionKeys.list(query) });
    toast.show({ message: t("transactions.list.refreshed") });
  }, [invalidCursor, query, queryClient, toast, t]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage)
        void fetchNextPage();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const rows = useMemo(
    () =>
      (list.data?.pages.flatMap((page) => page.data) ?? []).filter((row) =>
        matchesSearch(row, filters.q),
      ),
    [list.data, filters.q],
  );
  const total = list.data?.pages[0]?.pagination.total ?? null;
  const activeCount = countActiveFilters(filters);
  const periodLabel =
    filters.period === "month"
      ? dates.formatMonth(new Date())
      : filters.period === "custom" && window
        ? dates.formatRange(window.from, new Date(window.to.getTime() - 1))
        : t(`transactions.list.periods.${filters.period}`);
  const offline = list.fetchStatus === "paused" && !list.data;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("transactions.list.title")}
        actions={
          <>
            <Button
              variant="ghost"
              iconOnly
              round
              disabled={!isEnabled("exportTransactions")}
              aria-label={t("transactions.list.export")}
            >
              <Download {...iconProps("md")} />
            </Button>
            <span className="hidden md:inline-flex">
              <Link href={ADD_HREF} className={buttonClasses({})}>
                {t("nav.add")}
              </Link>
            </span>
          </>
        }
      />
      <Input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
        placeholder={t("transactions.list.search")}
        aria-label={t("transactions.list.search")}
        leading={<Search {...iconProps("sm")} />}
        autoComplete="off"
      />
      <ChipRow>
        <Chip
          icon={<SlidersHorizontal {...iconProps("sm")} />}
          aria-haspopup="dialog"
          aria-label={
            activeCount > 0
              ? `${t("transactions.list.filters")} · ${t("transactions.list.activeFilters", { count: activeCount })}`
              : t("transactions.list.filters")
          }
          onClick={() => {
            setFiltersOpen(true);
          }}
        >
          {t("transactions.list.filters")}
          {activeCount > 0 && <Badge tone="brand">{activeCount}</Badge>}
        </Chip>
        <Chip
          selected
          onClick={() => {
            setFiltersOpen(true);
          }}
        >
          {periodLabel}
        </Chip>
        {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((type) => (
          <Chip
            key={type}
            selected={filters.type === type}
            onClick={() => {
              apply({ ...filters, type: filters.type === type ? null : type });
            }}
          >
            {t(`transactions.list.types.${type}`)}
          </Chip>
        ))}
        <Chip
          selected={filters.pendingDetails}
          onClick={() => {
            apply({ ...filters, pendingDetails: !filters.pendingDetails });
          }}
        >
          {pendingCount > 0
            ? t("transactions.list.toReviewCount", { count: pendingCount })
            : t("transactions.list.toReview")}
        </Chip>
        <Chip
          selected={filters.uncategorized}
          onClick={() => {
            apply({ ...filters, uncategorized: !filters.uncategorized, categoryId: null });
          }}
        >
          {t("transactions.list.uncategorized")}
        </Chip>
        {filters.tag && (
          <Chip
            selected
            onClick={() => {
              apply({ ...filters, tag: null });
            }}
          >
            {t("transactions.list.tagChip", { tag: filters.tag })}
          </Chip>
        )}
      </ChipRow>
      {window && (
        <PeriodSummary
          periodLabel={periodLabel}
          spent={totals?.spent ?? null}
          income={totals?.income ?? null}
          count={total}
        />
      )}
      {list.isPending && !offline ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      ) : offline ? (
        <Empty
          icon={<WifiOff {...iconProps("lg")} />}
          title={t("transactions.list.offline.title")}
          body={t("transactions.list.offline.body")}
        />
      ) : list.isError && !invalidCursor ? (
        <Empty
          tone="danger"
          icon={<WifiOff {...iconProps("lg")} />}
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
        activeCount === 0 && !filters.q && total === 0 ? (
          <Empty
            icon={<Inbox {...iconProps("lg")} />}
            title={t("transactions.list.empty.title")}
            body={t("transactions.list.empty.body")}
            action={
              <Link href={ADD_HREF} className={buttonClasses({})}>
                {t("transactions.list.empty.cta")}
              </Link>
            }
          />
        ) : (
          <Empty
            icon={<Search {...iconProps("lg")} />}
            title={t("transactions.list.noMatch.title")}
            body={t("transactions.list.noMatch.body")}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  apply(DEFAULT_FILTERS);
                }}
              >
                {t("transactions.list.noMatch.cta")}
              </Button>
            }
          />
        )
      ) : (
        <>
          <TransactionDayList
            transactions={rows}
            lookups={lookups}
            dayTotals={totals?.byDay}
            onOpen={(transaction) => {
              router.push(`/transactions/${transaction.id}`);
            }}
          />
          <div ref={sentinel} aria-hidden="true" className="h-px" />
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
      {filtersOpen && (
        <FiltersSheet
          open
          filters={filters}
          onClose={() => {
            setFiltersOpen(false);
          }}
          onApply={(next) => {
            setFiltersOpen(false);
            apply(next);
          }}
        />
      )}
    </div>
  );
}
