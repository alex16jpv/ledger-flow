"use client";

import { ChartLine, CircleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ColBars, type Column } from "@/components/ui/ColBars";
import { Empty } from "@/components/ui/Empty";
import { GBars, type Pair } from "@/components/ui/GBars";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Projected } from "@/components/ui/Projected";
import { Segment } from "@/components/ui/Segment";
import { Skeleton } from "@/components/ui/Skeleton";
import { Trend } from "@/components/ui/Trend";
import { currentMonthKey, monthReference, parseMonthKey } from "@/features/budgets/reference";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { StatTile } from "@/features/stats/components/StatsCards";
import { useStatsQuery } from "@/features/stats/hooks";
import { UNCATEGORIZED_KEY } from "@/features/stats/model";
import {
  categoryMix,
  isTrendRange,
  monthComparison,
  OTHER_KEY,
  savings,
  TOP_CATEGORIES,
  TREND_RANGES,
  trendMonths,
  type TrendRange,
  trendWindow,
} from "@/features/stats/trends";
import { monthWindow, shiftMonth, toIsoWindow } from "@/lib/format/dates";
import { useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { useBackNavigation } from "@/lib/navigation/history";
import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

const DEFAULT_RANGE: TrendRange = 6;
const OTHER_COLOR: ColorToken = "GRAY";

function parseRange(value: string | null): TrendRange {
  const months = Number(value);
  return isTrendRange(months) ? months : DEFAULT_RANGE;
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-caps text-text-3 uppercase">{title}</span>
      {children}
    </Card>
  );
}

function CardError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations("common");
  return (
    <Card>
      <Empty
        tone="danger"
        icon={<CircleAlert {...iconProps("lg")} />}
        title={title}
        body={<LoadErrorBody error={error} />}
        action={<Button onClick={onRetry}>{t("retry")}</Button>}
      />
    </Card>
  );
}

function ChartSkeleton({ height, lines = 1 }: { height: number; lines?: number }) {
  const t = useTranslations("common");
  return (
    <Card className="flex flex-col gap-2" aria-busy="true" aria-label={t("loading")}>
      <Skeleton className="h-2.5 w-28" />
      <Skeleton className="mt-[22px]" style={{ height }} />
      <Skeleton className="h-3 w-3/5" />
      {lines > 1 && <Skeleton className="h-3 w-2/5" />}
    </Card>
  );
}

function LegendKey({
  paint,
  color,
  label,
}: {
  paint: string;
  color?: ColorToken | null;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <i aria-hidden="true" className={paint} style={featureColorStyle(color)} />
      {label}
    </span>
  );
}

export function TrendsScreen() {
  const t = useTranslations();
  const params = useSearchParams();
  const router = useRouter();
  const back = useBackNavigation();
  const dates = useDates();
  const money = useMoney();
  const outbox = useOutbox();
  const [now] = useState(() => new Date());

  const monthKey = parseMonthKey(params.get("reference"), now, dates.timeZone);
  const range = parseRange(params.get("range"));
  const { reference } = monthReference(monthKey, dates.timeZone, now);
  const runningKey = monthKey === currentMonthKey(now, dates.timeZone) ? monthKey : null;

  const window = useMemo(
    () => trendWindow(reference, range, dates.timeZone),
    [reference, range, dates.timeZone],
  );
  const iso = toIsoWindow(window);
  const here = useMemo(() => monthWindow(reference, dates.timeZone), [reference, dates.timeZone]);
  const before = useMemo(
    () => monthWindow(shiftMonth(reference, -1, dates.timeZone), dates.timeZone),
    [reference, dates.timeZone],
  );

  const spending = useStatsQuery({ type: "EXPENSE", groupBy: "month", ...iso });
  const income = useStatsQuery({ type: "INCOME", groupBy: "month", ...iso });
  const mix = useStatsQuery({ type: "EXPENSE", groupBy: "month", splitBy: "category", ...iso });
  const ranking = useStatsQuery({ type: "EXPENSE", groupBy: "category", ...iso });
  const thisMonth = useStatsQuery({
    type: "EXPENSE",
    groupBy: "day",
    ...toIsoWindow(here),
  });
  const lastMonth = useStatsQuery({
    type: "EXPENSE",
    groupBy: "day",
    ...toIsoWindow(before),
  });
  const categories = useCategoriesQuery(undefined, true, true);
  const categoryMap = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );

  const months = useMemo(
    () =>
      income.data && spending.data
        ? trendMonths(
            income.data.buckets,
            spending.data.buckets,
            window,
            range,
            dates.timeZone,
            runningKey,
          )
        : [],
    [income.data, spending.data, window, range, dates.timeZone, runningKey],
  );

  const totals = useMemo(
    () =>
      income.data && spending.data ? savings(income.data.total, spending.data.total, months) : null,
    [income.data, spending.data, months],
  );

  const comparison = useMemo(
    () =>
      thisMonth.data && lastMonth.data
        ? monthComparison(
            thisMonth.data.buckets,
            lastMonth.data.buckets,
            here,
            before,
            dates.timeZone,
            now,
          )
        : null,
    [thisMonth.data, lastMonth.data, here, before, dates.timeZone, now],
  );

  const columns = useMemo<Column[]>(() => {
    if (!mix.data || !ranking.data) return [];
    const top = ranking.data.buckets.slice(0, TOP_CATEGORIES).map((bucket) => bucket.key);
    return categoryMix(months, mix.data.buckets, top).map((column) => ({
      label: t(column.running ? "trends.monthSlotRunning" : "trends.monthSlot", {
        month: dates.formatMonth(column.from),
        amount: money.format(column.total),
      }),
      amount: money.format(column.total),
      partial: column.running,
      segments: column.segments.map((segment) => ({
        value: segment.total,
        color:
          segment.key === OTHER_KEY ? OTHER_COLOR : (categoryMap.get(segment.key)?.color ?? null),
      })),
    }));
  }, [mix.data, ranking.data, months, categoryMap, dates, money, t]);

  const legend = useMemo(() => {
    if (!ranking.data) return [];
    const named = ranking.data.buckets.slice(0, TOP_CATEGORIES).map((bucket) => ({
      key: bucket.key,
      color: categoryMap.get(bucket.key)?.color ?? null,
      name:
        bucket.key === UNCATEGORIZED_KEY
          ? t("stats.uncategorized")
          : (categoryMap.get(bucket.key)?.name ?? t("stats.unknownCategory")),
    }));
    return ranking.data.buckets.length > TOP_CATEGORIES
      ? [...named, { key: OTHER_KEY, color: OTHER_COLOR, name: t("trends.other") }]
      : named;
  }, [ranking.data, categoryMap, t]);

  const pairs: Pair[] = months.map((month) => ({
    label: t(month.running ? "trends.monthPairRunning" : "trends.monthPair", {
      month: dates.formatMonth(month.from),
      income: money.format(month.income),
      spending: money.format(month.spending),
    }),
    income: month.income,
    spending: month.spending,
    partial: month.running,
  }));

  const openMonth = (index: number) => {
    const month = months[index];
    if (!month) return;
    router.push({ pathname: "/stats", query: { reference: month.key } });
  };

  const rangeLoading = income.isPending || spending.isPending;
  const rangeError = income.isError || spending.isError;
  const nothing = !rangeLoading && !rangeError && months.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={t("trends.title")}
        onBack={() => {
          back("/stats");
        }}
      />
      <Segment<string>
        label={t("trends.rangeLabel")}
        value={String(range)}
        onChange={(next) => {
          router.replace({
            pathname: "/stats/trends",
            query: {
              ...(monthKey === currentMonthKey(now, dates.timeZone) ? {} : { reference: monthKey }),
              ...(Number(next) === DEFAULT_RANGE ? {} : { range: next }),
            },
          });
        }}
        options={TREND_RANGES.map((option) => ({
          value: String(option),
          label: t("trends.range", { months: option }),
        }))}
      />
      {months.length > 0 && months.length < range && (
        <Alert tone="neutral">
          {t("trends.shortHistory", { months: months.length, complete: totals?.complete ?? 0 })}
        </Alert>
      )}

      {nothing ? (
        <Card>
          <Empty
            icon={<ChartLine {...iconProps("lg")} />}
            title={t("trends.empty.title")}
            body={t("trends.empty.body")}
          />
        </Card>
      ) : (
        <>
          {rangeLoading ? (
            <>
              <ChartSkeleton height={128} />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-[68px] rounded-lg" />
                <Skeleton className="h-[68px] rounded-lg" />
              </div>
            </>
          ) : rangeError ? (
            <CardError
              title={t("trends.errorMonths")}
              error={income.error ?? spending.error}
              onRetry={() => {
                void income.refetch();
                void spending.refetch();
              }}
            />
          ) : (
            <>
              <ChartCard title={t("trends.incomeAndSpending")}>
                <Projected when={outbox.projected.spending} align="center" className="w-full">
                  <GBars
                    pairs={pairs}
                    label={t("trends.incomeAndSpendingReading")}
                    onSelect={openMonth}
                    className="flex-1"
                  />
                </Projected>
                <div className="flex justify-between gap-2 text-xs text-text-3">
                  {months.map((month) => (
                    <span key={month.key} className="flex-1 truncate text-center">
                      {dates.formatMonthShort(month.from)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-text-2">
                  <LegendKey
                    paint="h-2 w-2 rounded-[2px] bg-income"
                    label={t("trends.legendIncome")}
                  />
                  <LegendKey
                    paint="h-2 w-2 rounded-[2px] bg-brand"
                    label={t("trends.legendSpending")}
                  />
                </div>
              </ChartCard>
              {totals && (
                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    label={t("trends.saved")}
                    value={money.format(totals.saved)}
                    sub={t("trends.savedSub", { count: totals.complete })}
                  />
                  <StatTile
                    label={t("trends.savingsRate")}
                    value={
                      totals.rate === null
                        ? t("trends.noRate")
                        : t("trends.percent", { percent: Math.round(totals.rate * 100) })
                    }
                    sub={totals.rate === null ? undefined : t("trends.savingsRateSub")}
                  />
                </div>
              )}
            </>
          )}

          {thisMonth.isPending || lastMonth.isPending ? (
            <ChartSkeleton height={120} lines={2} />
          ) : thisMonth.isError || lastMonth.isError ? (
            <CardError
              title={t("trends.errorComparison")}
              error={thisMonth.error ?? lastMonth.error}
              onRetry={() => {
                void thisMonth.refetch();
                void lastMonth.refetch();
              }}
            />
          ) : (
            comparison && (
              <ChartCard title={t("trends.thisAgainstLast")}>
                {comparison.spentSoFar === 0 ? (
                  <Empty
                    icon={<ChartLine {...iconProps("lg")} />}
                    title={t("trends.empty.title")}
                    body={t("trends.emptyComparison")}
                  />
                ) : (
                  <>
                    <Projected when={outbox.projected.spending} align="center" className="w-full">
                      <span className="flex w-full flex-col gap-2">
                        <Trend
                          lines={[
                            { points: comparison.previous, tone: "pace" },
                            { points: comparison.current, tone: "spent", dot: true },
                          ]}
                          label={t("trends.comparisonReading")}
                        />
                        <span className="flex justify-between text-xs text-text-3">
                          <span>{t("trends.axisDay", { day: 1 })}</span>
                          <span>{t("trends.axisDay", { day: comparison.days })}</span>
                        </span>
                        <span className="block text-sm text-text-2">
                          {comparison.difference === null
                            ? t.rich("trends.spentNoComparison", {
                                amount: money.format(comparison.spentSoFar),
                                month: dates.formatMonth(before.from),
                                b: (chunks) => (
                                  <b className="font-medium text-text tabular-nums">{chunks}</b>
                                ),
                              })
                            : t.rich(
                                comparison.difference < 0 ? "trends.spentLess" : "trends.spentMore",
                                {
                                  amount: money.format(comparison.spentSoFar),
                                  percent: Math.abs(Math.round(comparison.difference * 100)),
                                  month: dates.formatMonth(before.from),
                                  b: (chunks) => (
                                    <b className="font-medium text-text tabular-nums">{chunks}</b>
                                  ),
                                },
                              )}
                        </span>
                      </span>
                    </Projected>
                    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-text-2">
                      <LegendKey
                        paint="h-2 w-2 rounded-[2px] bg-brand"
                        label={dates.formatMonth(here.from)}
                      />
                      <LegendKey
                        paint="h-0.5 w-3.5 rounded-full bg-text-3"
                        label={t("trends.legendPrevious", {
                          month: dates.formatMonth(before.from),
                        })}
                      />
                    </div>
                  </>
                )}
              </ChartCard>
            )
          )}

          {mix.isPending || ranking.isPending ? (
            <ChartSkeleton height={132} />
          ) : mix.isError || ranking.isError ? (
            <CardError
              title={t("trends.errorMix")}
              error={mix.error ?? ranking.error}
              onRetry={() => {
                void mix.refetch();
                void ranking.refetch();
              }}
            />
          ) : (
            columns.length > 0 && (
              <ChartCard title={t("trends.whereItGoes")}>
                <Projected when={outbox.projected.spending} align="center" className="w-full">
                  <ColBars
                    columns={columns}
                    label={t("trends.whereItGoesReading")}
                    height={132}
                    onSelect={openMonth}
                    className="flex-1"
                  />
                </Projected>
                <div className="flex justify-between gap-2 text-xs text-text-3">
                  {months.map((month) => (
                    <span key={month.key} className="flex-1 truncate text-center">
                      {dates.formatMonthShort(month.from)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-text-2">
                  {legend.map((entry) => (
                    <LegendKey
                      key={entry.key}
                      paint={
                        entry.color === null
                          ? "h-2 w-2 rounded-[2px] bg-brand"
                          : "h-2 w-2 rounded-[2px] bg-(--f)"
                      }
                      color={entry.color}
                      label={entry.name}
                    />
                  ))}
                </div>
              </ChartCard>
            )
          )}
          <p className="text-xs text-text-3">{t("trends.timeZoneNote")}</p>
        </>
      )}
    </div>
  );
}
