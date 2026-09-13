"use client";

import { ChartColumn, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  ChartCard,
  ChartError,
  ChartLegend,
  ChartSkeleton,
  LegendKey,
} from "@/components/ui/ChartCard";
import { ColBars, type Column } from "@/components/ui/ColBars";
import { DayBars } from "@/components/ui/DayBars";
import { Empty } from "@/components/ui/Empty";
import { Projected } from "@/components/ui/Projected";
import { List } from "@/components/ui/Row";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Trend, type TrendLine } from "@/components/ui/Trend";
import { hasPeriodHistory, paceSeries } from "@/features/budgets/charts";
import { useBudgetHistoryQuery, useBudgetSpendingQuery } from "@/features/budgets/hooks";
import { CategoryRows, StackBar } from "@/features/stats/components/StatsCards";
import { daySeries, shares, UNCATEGORIZED_KEY } from "@/features/stats/model";
import {
  type TransactionLookups,
  TransactionRow,
} from "@/features/transactions/components/TransactionRow";
import { useBiggestTransactions } from "@/features/transactions/hooks";
import { dayKey } from "@/lib/format/dates";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Budget, Category } from "@/types/api";

const PREVIOUS_PERIODS = 5;

const PACE_PAINT = {
  spent: "h-2 w-2 rounded-[2px] bg-brand",
  pace: "h-0.5 w-3.5 rounded-full bg-text-3",
  projection: "h-0.5 w-3.5 rounded-full bg-danger opacity-55",
  limit: "h-0.5 w-3.5 rounded-full bg-danger",
} as const;

function CardEmpty({ body }: { body: string }) {
  const t = useTranslations("budgets.detail.charts");
  return <Empty icon={<ChartColumn {...iconProps("lg")} />} title={t("emptyTitle")} body={body} />;
}

export interface BudgetChartsProps {
  budget: Budget;
  now: Date;
  categories: ReadonlyMap<string, Category>;
  lookups: TransactionLookups;
}

export function BudgetCharts({ budget, now, categories, lookups }: BudgetChartsProps) {
  const t = useTranslations();
  const dates = useDates();
  const money = useMoney();
  const router = useRouter();
  const outbox = useOutbox();

  const window = useMemo(
    () => ({ from: new Date(budget.periodFrom), to: new Date(budget.periodTo) }),
    [budget.periodFrom, budget.periodTo],
  );
  const spendingParams = {
    type: budget.type,
    categoryIds: budget.categoryIds,
    from: budget.periodFrom,
    to: budget.periodTo,
  };
  const perDay = useBudgetSpendingQuery(budget.id, { ...spendingParams, groupBy: "day" });
  const splits = budget.categoryIds.length > 1;
  const perCategory = useBudgetSpendingQuery(
    budget.id,
    { ...spendingParams, groupBy: "category" },
    splits,
  );
  const history = useBudgetHistoryQuery(
    budget.id,
    budget.periodFrom,
    PREVIOUS_PERIODS,
    hasPeriodHistory(budget),
  );
  const biggest = useBiggestTransactions({
    from: budget.periodFrom,
    to: budget.periodTo,
    type: budget.type,
    ...(budget.categoryIds.length > 0 ? { categoryIds: budget.categoryIds.join(",") } : {}),
  });

  const series = useMemo(
    () =>
      perDay.data
        ? daySeries(perDay.data.buckets, window, dates.timeZone, now, perDay.data.total)
        : null,
    [perDay.data, window, dates.timeZone, now],
  );
  const pace = useMemo(
    () => (series ? paceSeries(series.bars, budget.amount) : null),
    [series, budget.amount],
  );

  const single = budget.categoryIds.length === 1 ? budget.categoryIds[0] : undefined;
  function openDay(key: string) {
    router.push({
      pathname: "/transactions",
      query: {
        period: "custom",
        from: key,
        to: key,
        type: budget.type,
        ...(single ? { category: single } : {}),
      },
    });
  }

  const lastDay = dayKey(new Date(window.to.getTime() - 1), dates.timeZone);
  const periodHref = {
    pathname: "/transactions" as const,
    query: {
      period: "custom",
      from: dayKey(window.from, dates.timeZone),
      to: lastDay,
      type: budget.type,
      ...(single ? { category: single } : {}),
    },
  };

  const axisLabel = (period: Budget): string => {
    const from = new Date(period.periodFrom);
    if (period.periodType === "YEARLY") return dates.formatYear(from);
    if (period.periodType === "MONTHLY" || period.periodType === "QUARTERLY") {
      return dates.formatMonthShort(from);
    }
    return dates.formatDay(from);
  };
  const periodName = (period: Budget): string =>
    period.periodType === "MONTHLY"
      ? dates.formatMonth(new Date(period.periodFrom))
      : dates.formatRange(
          new Date(period.periodFrom),
          new Date(new Date(period.periodTo).getTime() - 1),
        );

  const periods = [...(history.data ?? []), budget];
  const running = (period: Budget): boolean =>
    period.periodTo === budget.periodTo && now.getTime() < window.to.getTime();
  const columns: Column[] = periods.map((period) => ({
    label: t(
      running(period)
        ? "budgets.detail.charts.periodSlotRunning"
        : "budgets.detail.charts.periodSlot",
      {
        period: periodName(period),
        amount: money.format(period.spent),
        limit: money.format(period.amount),
      },
    ),
    amount: money.format(period.spent),
    segments: [{ value: period.spent, color: budget.color, over: period.spent > period.amount }],
    cap: period.amount,
    partial: running(period),
  }));
  const finished = periods.filter((period) => !running(period));

  // `reference` in the URL is a month key, so no other period type has a column it can name.
  const openPeriod =
    budget.periodType === "MONTHLY"
      ? (index: number) => {
          const period = periods[index];
          if (!period) return;
          router.replace({
            pathname: `/budgets/${budget.id}`,
            query: { reference: dayKey(new Date(period.periodFrom), dates.timeZone).slice(0, 7) },
          });
        }
      : undefined;

  const over = finished.filter((period) => period.spent > period.amount).length;
  const currentOver = budget.spent > budget.amount && now.getTime() < window.to.getTime();

  const categoryShares = perCategory.data
    ? shares(perCategory.data.buckets, perCategory.data.total)
    : [];

  const endsOver = pace?.endsAt !== null && pace !== null && pace.endsAt > budget.amount;

  return (
    <>
      {perDay.isPending ? (
        <>
          <ChartSkeleton height={120} />
          <ChartSkeleton height={128} lines={2} />
        </>
      ) : perDay.isError || !series || !pace ? (
        <Card>
          <ChartError
            title={t("budgets.detail.charts.errorDay")}
            error={perDay.error}
            onRetry={() => {
              void perDay.refetch();
            }}
          />
        </Card>
      ) : (
        <>
          <ChartCard title={t("budgets.detail.charts.perDay")}>
            {perDay.data.total === 0 ? (
              <CardEmpty body={t("budgets.detail.charts.emptyDay")} />
            ) : (
              <>
                <Projected when={outbox.projected.spending} align="center" className="w-full">
                  <DayBars
                    days={series.bars}
                    label={t("budgets.detail.charts.perDay")}
                    height={120}
                    summary={
                      series.highest
                        ? {
                            label: t("charts.highestDay", {
                              day: dates.formatLong(dates.fromDayKey(series.highest.key)),
                            }),
                            amount: money.format(series.highest.total),
                          }
                        : undefined
                    }
                    onOpen={openDay}
                    className="flex-1"
                  />
                </Projected>
                <div className="flex justify-between text-xs text-text-3">
                  <span>{dates.formatDay(window.from)}</span>
                  <span>{dates.formatDay(new Date(window.to.getTime() - 1))}</span>
                </div>
              </>
            )}
          </ChartCard>

          <ChartCard
            title={t("budgets.detail.charts.pace")}
            right={
              endsOver ? (
                <Badge tone="danger">
                  <TrendingUp {...iconProps("sm")} />
                  {t("budgets.detail.charts.over")}
                </Badge>
              ) : undefined
            }
          >
            {pace.spentSoFar === 0 ? (
              <CardEmpty body={t("budgets.detail.charts.emptyPace")} />
            ) : (
              <>
                <Projected when={outbox.projected.spending} align="center" className="w-full">
                  <span className="flex w-full flex-col gap-2">
                    <Trend
                      lines={paceLines(pace, budget.amount)}
                      limit={budget.amount}
                      label={t(
                        pace.projection
                          ? "budgets.detail.charts.paceReadingProjected"
                          : "budgets.detail.charts.paceReading",
                      )}
                    />
                    <span className="relative block h-4 text-xs text-text-3">
                      <span className="absolute left-0">{dates.formatDay(window.from)}</span>
                      {pace.elapsedDays < pace.days && (
                        <span
                          className="absolute -translate-x-1/2"
                          style={{ left: `${String((pace.elapsedDays / pace.days) * 100)}%` }}
                        >
                          {t("budgets.detail.charts.today")}
                        </span>
                      )}
                      <span className="absolute right-0">
                        {dates.formatDay(new Date(window.to.getTime() - 1))}
                      </span>
                    </span>
                    <span className="block text-sm text-text-2">
                      {pace.endsAt === null
                        ? t("budgets.detail.charts.noProjection", { day: pace.elapsedDays })
                        : t.rich(
                            pace.endsAt > budget.amount
                              ? "budgets.detail.charts.endsOver"
                              : "budgets.detail.charts.endsUnder",
                            {
                              amount: money.format(money.round(pace.endsAt)),
                              difference: money.format(
                                money.round(Math.abs(pace.endsAt - budget.amount)),
                              ),
                              b: (chunks) => (
                                <b className="font-medium text-text tabular-nums">{chunks}</b>
                              ),
                              over: (chunks) => (
                                <b className="font-medium text-danger tabular-nums">{chunks}</b>
                              ),
                            },
                          )}
                    </span>
                  </span>
                </Projected>
                <ChartLegend>
                  <LegendKey
                    paint={PACE_PAINT.spent}
                    label={t("budgets.detail.charts.legendSpent")}
                  />
                  <LegendKey
                    paint={PACE_PAINT.pace}
                    label={t("budgets.detail.charts.legendPace")}
                  />
                  {pace.projection && (
                    <LegendKey
                      paint={PACE_PAINT.projection}
                      label={t("budgets.detail.charts.legendProjection")}
                    />
                  )}
                  <LegendKey
                    paint={PACE_PAINT.limit}
                    label={t("budgets.detail.charts.legendLimit")}
                  />
                </ChartLegend>
              </>
            )}
          </ChartCard>
        </>
      )}

      {history.isPending && hasPeriodHistory(budget) ? (
        <ChartSkeleton height={110} />
      ) : history.isError ? (
        <Card>
          <ChartError
            title={t("budgets.detail.charts.errorHistory")}
            error={history.error}
            onRetry={() => {
              void history.refetch();
            }}
          />
        </Card>
      ) : (
        columns.length > 1 && (
          <ChartCard title={t("budgets.detail.charts.history", { count: columns.length })}>
            <Projected when={outbox.projected.budgets} align="center" className="w-full">
              <ColBars
                columns={columns}
                label={t("budgets.detail.charts.historyReading")}
                onSelect={openPeriod}
                summary={{
                  label: `${
                    over > 0
                      ? t("budgets.detail.charts.wentOver", { over, complete: finished.length })
                      : t("budgets.detail.charts.wentOverNone", { complete: finished.length })
                  }${currentOver ? ` ${t("budgets.detail.charts.currentOver")}` : ""}`,
                }}
                className="flex-1"
              />
            </Projected>
            <div className="flex justify-between gap-2 text-xs text-text-3">
              {periods.map((period) => (
                <span key={period.periodFrom} className="flex-1 truncate text-center">
                  {axisLabel(period)}
                </span>
              ))}
            </div>
          </ChartCard>
        )
      )}

      {splits && (
        <section aria-labelledby="budget-breakdown" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 id="budget-breakdown" className="text-md font-semibold">
              {t("budgets.detail.charts.breakdown")}
            </h2>
            <span className="text-sm text-text-3 tabular-nums">
              {t("budgets.detail.charts.breakdownTotal", {
                amount: money.format(budget.spent),
                limit: money.format(budget.amount),
              })}
            </span>
          </div>
          {perCategory.isPending ? (
            <Card flush role="status" aria-busy="true" aria-label={t("common.loading")}>
              <SkeletonRow />
              <SkeletonRow />
            </Card>
          ) : perCategory.isError ? (
            <Card>
              <ChartError
                title={t("stats.breakdown")}
                error={perCategory.error}
                onRetry={() => {
                  void perCategory.refetch();
                }}
              />
            </Card>
          ) : categoryShares.length === 0 ? (
            <Card>
              <CardEmpty body={t("budgets.detail.charts.emptyBiggest")} />
            </Card>
          ) : (
            <>
              <StackBar
                shares={categoryShares}
                colors={(key) => categories.get(key)?.color ?? null}
                names={(key) =>
                  key === UNCATEGORIZED_KEY
                    ? t("stats.uncategorized")
                    : (categories.get(key)?.name ?? t("stats.unknownCategory"))
                }
                label={t("stats.breakdown")}
              />
              <CategoryRows
                shares={categoryShares}
                type={budget.type}
                categories={categories}
                onOpen={(key) => {
                  router.push({
                    pathname: "/transactions",
                    query: {
                      period: "custom",
                      from: dayKey(window.from, dates.timeZone),
                      to: lastDay,
                      type: budget.type,
                      ...(key === UNCATEGORIZED_KEY ? { uncategorized: "1" } : { category: key }),
                    },
                  });
                }}
              />
            </>
          )}
        </section>
      )}

      <section aria-labelledby="budget-biggest" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="budget-biggest" className="text-md font-semibold">
            {t("budgets.detail.charts.biggest")}
          </h2>
          <Link href={periodHref} className="text-sm font-medium text-brand-text">
            {t("common.seeAll")}
          </Link>
        </div>
        <Card flush={biggest.isSuccess && biggest.data.data.length > 0}>
          {biggest.isPending ? (
            <div role="status" aria-busy="true" aria-label={t("common.loading")}>
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : biggest.isError ? (
            <ChartError
              title={t("budgets.detail.charts.errorBiggest")}
              error={biggest.error}
              onRetry={() => {
                void biggest.refetch();
              }}
            />
          ) : biggest.data.data.length === 0 ? (
            <CardEmpty body={t("budgets.detail.charts.emptyBiggest")} />
          ) : (
            <List>
              {biggest.data.data.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  lookups={lookups}
                  dated
                  onOpen={(row) => {
                    router.push(`/transactions/${row.id}`);
                  }}
                />
              ))}
            </List>
          )}
        </Card>
      </section>
    </>
  );
}

function paceLines(pace: ReturnType<typeof paceSeries>, amount: number): TrendLine[] {
  const over = pace.spentSoFar > amount;
  const lines: TrendLine[] = [
    { points: pace.pace, tone: "pace" },
    { points: pace.spent, tone: over ? "over" : "spent", dot: true },
  ];
  if (pace.projection) lines.splice(1, 0, { points: pace.projection, tone: "projection" });
  return lines;
}
