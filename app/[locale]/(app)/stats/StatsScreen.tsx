"use client";

import { ChartPie, Download, Scale } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Bars } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Segment } from "@/components/ui/Segment";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { useAccountsQuery } from "@/features/accounts/hooks";
import {
  currentMonthKey,
  monthReference,
  parseMonthKey,
  shiftMonthKey,
} from "@/features/budgets/reference";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { STATS_GROUPS, STATS_TYPES, type StatsGroup, type StatsType } from "@/features/stats/api";
import {
  AMOUNT_KIND,
  CategoryRows,
  StackBar,
  StatTile,
  TagRows,
  TotalCard,
} from "@/features/stats/components/StatsCards";
import { useStatsQuery } from "@/features/stats/hooks";
import {
  daySeries,
  shares,
  transactionCount,
  UNCATEGORIZED_KEY,
  UNTAGGED_KEY,
} from "@/features/stats/model";
import { TransactionDayList } from "@/features/transactions/components/TransactionDayList";
import type { TransactionLookups } from "@/features/transactions/components/TransactionRow";
import { useTransactionsInfinite } from "@/features/transactions/hooks";
import { isEnabled } from "@/lib/flags";
import { dayKey, dayWindow, monthWindow, toIsoWindow } from "@/lib/format/dates";
import { useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";

function parseType(value: string | null): StatsType {
  return (STATS_TYPES as readonly string[]).includes(value ?? "")
    ? (value as StatsType)
    : "EXPENSE";
}

function parseGroup(value: string | null): StatsGroup {
  return (STATS_GROUPS as readonly string[]).includes(value ?? "")
    ? (value as StatsGroup)
    : "category";
}

export function StatsScreen() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const dates = useDates();
  const money = useMoney();
  const [now] = useState(() => new Date());
  const monthKey = parseMonthKey(params.get("reference"), now, dates.timeZone);
  const type = parseType(params.get("type"));
  const groupBy = parseGroup(params.get("groupBy"));
  const { reference } = monthReference(monthKey, dates.timeZone, now);
  const window = useMemo(() => monthWindow(reference, dates.timeZone), [reference, dates.timeZone]);
  const iso = toIsoWindow(window);
  const stats = useStatsQuery({ type, groupBy, ...iso });
  const byCategory = useStatsQuery({ type, groupBy: "category", ...iso });
  const categories = useCategoriesQuery(undefined, true, true);
  const accounts = useAccountsQuery(true);
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
  const series = useMemo(
    () =>
      stats.data && groupBy === "day"
        ? daySeries(stats.data.buckets, window, dates.timeZone, now, stats.data.total)
        : null,
    [stats.data, groupBy, window, dates.timeZone, now],
  );
  const highestKey = series?.highest?.key ?? null;
  const highestWindow = highestKey
    ? toIsoWindow(dayWindow(new Date(`${highestKey}T12:00:00Z`), dates.timeZone))
    : null;
  const highestRows = useTransactionsInfinite(
    highestWindow ? { ...highestWindow, type } : {},
    highestWindow !== null,
  );

  function apply(next: { reference?: string; type?: StatsType; groupBy?: StatsGroup }) {
    const reference = next.reference ?? monthKey;
    const nextType = next.type ?? type;
    const nextGroup = next.groupBy ?? groupBy;
    router.replace({
      pathname: "/stats",
      query: {
        ...(reference === currentMonthKey(now, dates.timeZone) ? {} : { reference }),
        ...(nextType === "EXPENSE" ? {} : { type: nextType }),
        ...(nextGroup === "category" ? {} : { groupBy: nextGroup }),
      },
    });
  }

  const lastDay = dayKey(new Date(window.to.getTime() - 1), dates.timeZone);
  function openTransactions(extra: Record<string, string>) {
    router.push({
      pathname: "/transactions",
      query: {
        period: "custom",
        from: dayKey(window.from, dates.timeZone),
        to: lastDay,
        type,
        ...extra,
      },
    });
  }

  const total = stats.data?.total ?? 0;
  const count = byCategory.data ? transactionCount(byCategory.data.buckets) : 0;
  const empty = stats.isSuccess && stats.data.buckets.length === 0;
  const categoryShares =
    stats.data && groupBy === "category" ? shares(stats.data.buckets, total) : [];
  const tagShares =
    stats.data && groupBy === "tag"
      ? shares(
          stats.data.buckets.filter((bucket) => bucket.key !== UNTAGGED_KEY),
          total,
        )
      : [];
  const untagged = stats.data?.buckets.find((bucket) => bucket.key === UNTAGGED_KEY)?.total ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={t("stats.title")}
        actions={
          <Button
            variant="ghost"
            iconOnly
            round
            disabled={!isEnabled("exportTransactions")}
            aria-label={t("stats.export")}
          >
            <Download {...iconProps("md")} />
          </Button>
        }
      />
      <PeriodNav
        label={dates.formatMonth(reference)}
        previousLabel={t("stats.previousMonth")}
        nextLabel={t("stats.nextMonth")}
        nextDisabled={monthKey >= currentMonthKey(now, dates.timeZone)}
        onPrevious={() => {
          apply({ reference: shiftMonthKey(monthKey, -1, dates.timeZone) });
        }}
        onNext={() => {
          apply({ reference: shiftMonthKey(monthKey, 1, dates.timeZone) });
        }}
      />
      <ChipRow role="group" aria-label={t("transactions.filters.type")}>
        {STATS_TYPES.map((option) => (
          <Chip
            key={option}
            selected={type === option}
            icon={option === "ADJUSTMENT" ? <Scale {...iconProps("sm")} /> : undefined}
            onClick={() => {
              apply({ type: option });
            }}
          >
            {t(`stats.types.${option}`)}
          </Chip>
        ))}
      </ChipRow>
      <Segment<StatsGroup>
        label={t("stats.title")}
        value={groupBy}
        onChange={(next) => {
          apply({ groupBy: next });
        }}
        options={STATS_GROUPS.map((option) => ({
          value: option,
          label: t(`stats.groups.${option}`),
        }))}
      />
      {stats.isPending || byCategory.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("common.loading")}>
          <Card className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-3 w-56" />
          </Card>
          <Card flush>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        </div>
      ) : stats.isError || byCategory.isError ? (
        <Empty
          tone="danger"
          icon={<ChartPie {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={<LoadErrorBody error={stats.error ?? byCategory.error} />}
          action={
            <Button
              onClick={() => {
                void stats.refetch();
                void byCategory.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : empty ? (
        <Empty
          icon={<ChartPie {...iconProps("lg")} />}
          title={t("stats.empty.title")}
          body={t("stats.empty.body")}
        />
      ) : (
        <>
          <TotalCard
            type={type}
            total={total}
            count={count}
            average={count > 0 ? total / count : 0}
          />
          {type === "ADJUSTMENT" && <Alert tone="neutral">{t("stats.adjustmentsNote")}</Alert>}
          {groupBy === "category" && (
            <>
              <StackBar
                shares={categoryShares}
                colors={(key) => categoryMap.get(key)?.color ?? null}
                label={t("stats.breakdown")}
              />
              <CategoryRows
                shares={categoryShares}
                type={type}
                categories={categoryMap}
                onOpen={(key) => {
                  openTransactions(
                    key === UNCATEGORIZED_KEY ? { uncategorized: "1" } : { category: key },
                  );
                }}
              />
            </>
          )}
          {groupBy === "day" && series && (
            <>
              <Card className="flex flex-col gap-2">
                <Bars
                  bars={series.bars.map((bar) => ({
                    value: bar.value,
                    today: bar.today,
                    label: t("stats.dayBar", {
                      day: dates.formatDay(new Date(`${bar.key}T12:00:00Z`)),
                      amount: money.format(bar.value),
                    }),
                  }))}
                  label={t("stats.perDay")}
                  height={140}
                  onSelect={(index) => {
                    const key = series.bars[index]?.key;
                    if (key) openTransactions({ from: key, to: key });
                  }}
                />
                <div className="flex justify-between text-xs text-text-3">
                  <span>{dates.formatDay(window.from)}</span>
                  <span>
                    {series.bars[14]
                      ? dates.formatDay(new Date(`${series.bars[14].key}T12:00:00Z`))
                      : ""}
                  </span>
                  <span>{dates.formatDay(new Date(window.to.getTime() - 1))}</span>
                </div>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  label={type === "EXPENSE" ? t("stats.priciestDay") : t("stats.biggestDay")}
                  value={
                    <Amount
                      value={series.highest?.total ?? 0}
                      signed={false}
                      size="base"
                      className="text-lg font-semibold"
                    />
                  }
                  sub={
                    highestKey
                      ? dates.formatWeekdayDay(new Date(`${highestKey}T12:00:00Z`))
                      : undefined
                  }
                />
                <StatTile
                  label={t("stats.dailyAverage")}
                  value={
                    <Amount
                      value={money.round(series.dailyAverage)}
                      signed={false}
                      size="base"
                      className="text-lg font-semibold"
                    />
                  }
                />
                <StatTile
                  label={type === "EXPENSE" ? t("stats.noSpendDays") : t("stats.quietDays")}
                  value={series.noSpendDays}
                />
              </div>
              {highestKey && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-md font-semibold">
                      {t("stats.highest", {
                        day: dates.formatWeekdayDay(new Date(`${highestKey}T12:00:00Z`)),
                      })}
                    </h2>
                    <Amount
                      value={series.highest?.total ?? 0}
                      kind={AMOUNT_KIND[type]}
                      size="sm"
                      className="text-text-3"
                    />
                  </div>
                  {highestRows.isPending ? (
                    <Card flush role="status" aria-busy="true" aria-label={t("common.loading")}>
                      <SkeletonRow />
                      <SkeletonRow />
                    </Card>
                  ) : (
                    <TransactionDayList
                      transactions={highestRows.data?.pages.flatMap((page) => page.data) ?? []}
                      lookups={lookups}
                      onOpen={(transaction) => {
                        router.push(`/transactions/${transaction.id}`);
                      }}
                    />
                  )}
                </section>
              )}
            </>
          )}
          {groupBy === "tag" && (
            <>
              <Alert tone="neutral">
                {t("stats.tagsNote")}
                {untagged > 0
                  ? ` ${t("stats.untagged", { amount: money.format(untagged) })}`
                  : null}
              </Alert>
              {tagShares.length > 0 && (
                <TagRows
                  shares={tagShares}
                  type={type}
                  onOpen={(tag) => {
                    openTransactions({ tag });
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
