"use client";

import { ChartLine, TrendingUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useCallback, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import {
  ChartCard,
  ChartError,
  ChartLegend,
  ChartSkeleton,
  LegendKey,
} from "@/components/ui/ChartCard";
import type { ChartSlot } from "@/components/ui/ChartSlots";
import { ColBars, type Column } from "@/components/ui/ColBars";
import { Empty } from "@/components/ui/Empty";
import { GBars, type Pair } from "@/components/ui/GBars";
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
  comparisonPoints,
  isTrendRange,
  type MonthComparison,
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
import type { ColorToken } from "@/lib/theme/feature-color";

const DEFAULT_RANGE: TrendRange = 6;
const OTHER_COLOR: ColorToken = "GRAY";

const SWATCH = "h-2 w-2 rounded-[2px]";
const INCOME_SWATCH = `${SWATCH} bg-income`;
const SPENDING_SWATCH = `${SWATCH} bg-brand`;
const PREVIOUS_SWATCH = "h-0.5 w-3.5 rounded-full bg-text-3";
const CATEGORY_SWATCH = `${SWATCH} bg-(--f)`;

const percentOf = (difference: number | null): number =>
  Math.abs(Math.round((difference ?? 0) * 100));

function parseRange(value: string | null): TrendRange {
  const months = Number(value);
  return isTrendRange(months) ? months : DEFAULT_RANGE;
}

function ErrorCard(props: ComponentProps<typeof ChartError>) {
  return (
    <Card>
      <ChartError {...props} />
    </Card>
  );
}

const COMPARISON_MESSAGES = {
  running: {
    none: "trends.spentNoComparison",
    less: "trends.spentLess",
    more: "trends.spentMore",
    lessShort: "trends.spentLessShort",
    moreShort: "trends.spentMoreShort",
  },
  finished: {
    none: "trends.spentFinishedNoComparison",
    less: "trends.spentFinishedLess",
    more: "trends.spentFinishedMore",
    lessShort: "trends.spentFinishedLessShort",
    moreShort: "trends.spentFinishedMoreShort",
  },
} as const;

type ComparisonSet = (typeof COMPARISON_MESSAGES)[keyof typeof COMPARISON_MESSAGES];
type ComparisonMessage = ComparisonSet[keyof ComparisonSet];

// A finished month has no "so far", and a month shorter than the days elapsed has no "this point".
function comparisonMessage(comparison: MonthComparison, running: boolean): ComparisonMessage {
  const set = running ? COMPARISON_MESSAGES.running : COMPARISON_MESSAGES.finished;
  if (comparison.difference === null) return set.none;
  const short = comparison.comparedDays < comparison.days;
  if (comparison.difference < 0) return short ? set.lessShort : set.less;
  return short ? set.moreShort : set.more;
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
  const thisMonthKey = currentMonthKey(now, dates.timeZone);
  const runningKey = monthKey === thisMonthKey ? monthKey : null;

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

  // One read per datum (rule 24): `splitBy` only adds the splits, so this is also the spending series.
  const spending = useStatsQuery({
    type: "EXPENSE",
    groupBy: "month",
    splitBy: "category",
    ...iso,
  });
  const income = useStatsQuery({ type: "INCOME", groupBy: "month", ...iso });
  const ranking = useStatsQuery({ type: "EXPENSE", groupBy: "category", ...iso });
  const thisMonth = useStatsQuery({ type: "EXPENSE", groupBy: "day", ...toIsoWindow(here) });
  const lastMonth = useStatsQuery({ type: "EXPENSE", groupBy: "day", ...toIsoWindow(before) });
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
  // Its own months, so a failed income read takes this card's neighbour and not this card.
  const mixMonths = useMemo(
    () =>
      spending.data
        ? trendMonths([], spending.data.buckets, window, range, dates.timeZone, runningKey)
        : [],
    [spending.data, window, range, dates.timeZone, runningKey],
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

  // Index 0 of the curves is the origin, not a day: it reads nothing and shows no bubble.
  const comparisonSlots = useMemo<(ChartSlot | null)[]>(() => {
    if (!comparison) return [];
    const month = dates.formatMonthShort(here.from);
    const previous = dates.formatMonthShort(before.from);
    return [
      null,
      ...comparisonPoints(comparison).map((point) => {
        if (point.current === null) return null;
        const amount = money.format(point.current);
        if (point.previous === null)
          return { label: t("trends.pointAlone", { day: point.day, month, amount }) };
        const percent = percentOf(point.difference);
        const previousAmount = money.format(point.previous);
        const both = { day: point.day, month, amount, previous, previousAmount };
        return {
          label:
            percent === 0
              ? t("trends.pointFlat", both)
              : t(
                  point.difference !== null && point.difference < 0
                    ? "trends.pointLess"
                    : "trends.pointMore",
                  {
                    ...both,
                    percent,
                  },
                ),
        };
      }),
    ];
  }, [comparison, here.from, before.from, dates, money, t]);

  const categoryName = useCallback(
    (key: string): string =>
      key === OTHER_KEY
        ? t("trends.other")
        : key === UNCATEGORIZED_KEY
          ? t("stats.uncategorized")
          : (categoryMap.get(key)?.name ?? t("stats.unknownCategory")),
    [categoryMap, t],
  );

  const columns = useMemo<Column[]>(() => {
    if (!spending.data || !ranking.data) return [];
    const top = ranking.data.buckets.slice(0, TOP_CATEGORIES).map((bucket) => bucket.key);
    return categoryMix(mixMonths, spending.data.buckets, top).map((column) => ({
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
  }, [spending.data, ranking.data, mixMonths, categoryMap, dates, money, t]);

  const legend = useMemo(() => {
    if (!ranking.data) return [];
    const named = ranking.data.buckets.slice(0, TOP_CATEGORIES).map((bucket) => ({
      key: bucket.key,
      color: categoryMap.get(bucket.key)?.color ?? null,
      name: categoryName(bucket.key),
    }));
    return ranking.data.buckets.length > TOP_CATEGORIES
      ? [...named, { key: OTHER_KEY, color: OTHER_COLOR, name: t("trends.other") }]
      : named;
  }, [ranking.data, categoryMap, categoryName, t]);

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

  const openMonth = (from: readonly { key: string }[]) => (index: number) => {
    const month = from[index];
    if (!month) return;
    router.push({ pathname: "/stats", query: { reference: month.key } });
  };

  const biggest = ranking.data?.buckets[0];
  const rangeLoading = income.isPending || spending.isPending;
  const rangeError = income.isError || spending.isError;
  const nothing = !rangeLoading && !rangeError && months.length === 0;
  const complete = totals?.complete ?? 0;
  const running = runningKey !== null;

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
              ...(monthKey === thisMonthKey ? {} : { reference: monthKey }),
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
          {t("trends.shortHistory", { months: months.length, complete })}
        </Alert>
      )}

      {nothing ? (
        <Card>
          <Empty
            icon={<TrendingUp {...iconProps("lg")} />}
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
            <ErrorCard
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
                    onSelect={openMonth(months)}
                    summary={{ label: pairs.at(-1)?.label ?? "" }}
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
                <ChartLegend>
                  <LegendKey paint={INCOME_SWATCH} label={t("trends.legendIncome")} />
                  <LegendKey paint={SPENDING_SWATCH} label={t("trends.legendSpending")} />
                </ChartLegend>
              </ChartCard>
              {totals && (
                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    label={t("trends.saved")}
                    value={
                      complete === 0 ? (
                        t("trends.noComplete")
                      ) : (
                        <Projected when={outbox.projected.spending}>
                          <Amount value={totals.saved} signed={false} size="base" />
                        </Projected>
                      )
                    }
                    sub={
                      complete === 0
                        ? t("trends.noCompleteSub")
                        : t("trends.savedSub", { count: complete })
                    }
                  />
                  <StatTile
                    label={t("trends.savingsRate")}
                    value={
                      complete === 0 ? (
                        t("trends.noComplete")
                      ) : totals.rate === null ? (
                        t("trends.noRate")
                      ) : (
                        <Projected when={outbox.projected.spending}>
                          <span>
                            {t("trends.percent", { percent: Math.round(totals.rate * 100) })}
                          </span>
                        </Projected>
                      )
                    }
                    sub={
                      complete === 0
                        ? t("trends.noCompleteSub")
                        : totals.rate === null
                          ? undefined
                          : t("trends.savingsRateSub")
                    }
                  />
                </div>
              )}
            </>
          )}

          {thisMonth.isPending || lastMonth.isPending ? (
            <ChartSkeleton height={120} lines={2} />
          ) : thisMonth.isError || lastMonth.isError ? (
            <ErrorCard
              title={t("trends.errorComparison")}
              error={thisMonth.error ?? lastMonth.error}
              onRetry={() => {
                void thisMonth.refetch();
                void lastMonth.refetch();
              }}
            />
          ) : (
            comparison && (
              <ChartCard
                title={
                  running
                    ? t("trends.thisAgainstLast")
                    : t("trends.monthAgainst", {
                        month: dates.formatMonth(here.from),
                        previous: dates.formatMonth(before.from),
                      })
                }
              >
                {comparison.spentSoFar === 0 ? (
                  <Empty
                    icon={<ChartLine {...iconProps("lg")} />}
                    title={t("trends.comparisonEmptyTitle", {
                      month: dates.formatMonth(here.from),
                    })}
                    body={t("trends.comparisonEmptyBody")}
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
                          label={t("trends.comparisonReading", {
                            month: dates.formatMonth(here.from),
                            previous: dates.formatMonth(before.from),
                          })}
                          points={comparisonSlots}
                        />
                        <span className="flex justify-between text-xs text-text-3">
                          <span>{t("trends.axisDay", { day: 1 })}</span>
                          <span>{t("trends.axisDay", { day: comparison.days })}</span>
                        </span>
                        <span className="block text-sm text-text-2">
                          {t.rich(comparisonMessage(comparison, running), {
                            amount: money.format(comparison.spentSoFar),
                            percent: percentOf(comparison.difference),
                            days: comparison.comparedDays,
                            month: dates.formatMonth(before.from),
                            current: dates.formatMonth(here.from),
                            b: (chunks) => (
                              <b className="font-medium text-text tabular-nums">{chunks}</b>
                            ),
                          })}
                        </span>
                      </span>
                    </Projected>
                    <ChartLegend>
                      <LegendKey paint={SPENDING_SWATCH} label={dates.formatMonth(here.from)} />
                      <LegendKey
                        paint={PREVIOUS_SWATCH}
                        label={t("trends.legendPrevious", {
                          month: dates.formatMonth(before.from),
                        })}
                      />
                    </ChartLegend>
                  </>
                )}
              </ChartCard>
            )
          )}

          {spending.isPending || ranking.isPending ? (
            <ChartSkeleton height={132} />
          ) : spending.isError || ranking.isError ? (
            <ErrorCard
              title={t("trends.errorMix")}
              error={spending.error ?? ranking.error}
              onRetry={() => {
                void spending.refetch();
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
                    onSelect={openMonth(mixMonths)}
                    summary={
                      biggest
                        ? {
                            label: t("trends.topCategory", { name: categoryName(biggest.key) }),
                            amount: money.format(biggest.total),
                          }
                        : undefined
                    }
                    className="flex-1"
                  />
                </Projected>
                <div className="flex justify-between gap-2 text-xs text-text-3">
                  {mixMonths.map((month) => (
                    <span key={month.key} className="flex-1 truncate text-center">
                      {dates.formatMonthShort(month.from)}
                    </span>
                  ))}
                </div>
                <ChartLegend>
                  {legend.map((entry) => (
                    <LegendKey
                      key={entry.key}
                      paint={entry.color === null ? SPENDING_SWATCH : CATEGORY_SWATCH}
                      color={entry.color}
                      label={entry.name}
                    />
                  ))}
                </ChartLegend>
              </ChartCard>
            )
          )}
          <p className="text-xs text-text-3">{t("trends.timeZoneNote")}</p>
        </>
      )}
    </div>
  );
}
