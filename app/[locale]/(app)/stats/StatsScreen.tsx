"use client";

import { CalendarDays, ChartColumn, ChartPie, Download, Scale } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { type Bar, Bars } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { DayBars } from "@/components/ui/DayBars";
import { DayHeat } from "@/components/ui/DayHeat";
import { useWeekdayNames } from "@/components/ui/dayReading";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Projected } from "@/components/ui/Projected";
import { List } from "@/components/ui/Row";
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
  AccountRows,
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
  UNASSIGNED_ACCOUNT_KEY,
  UNCATEGORIZED_KEY,
  UNTAGGED_KEY,
  weekdayAverages,
} from "@/features/stats/model";
import { TransactionDayList } from "@/features/transactions/components/TransactionDayList";
import {
  type TransactionLookups,
  TransactionRow,
} from "@/features/transactions/components/TransactionRow";
import { useBiggestTransactions, useTransactionsInfinite } from "@/features/transactions/hooks";
import { type DayView, dayViewStore, setDayView } from "@/lib/charts/day-view";
import { weekColumns, weekStartFor } from "@/lib/charts/days";
import { isEnabled } from "@/lib/flags";
import { dayKey, monthWindow, toIsoWindow } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";

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
  const outbox = useOutbox();
  const router = useRouter();
  const params = useSearchParams();
  const dates = useDates();
  const money = useMoney();
  const { formatLocale } = useFormatSettings();
  const [now] = useState(() => new Date());
  const view = useSyncExternalStore(
    dayViewStore.subscribe,
    dayViewStore.getSnapshot,
    dayViewStore.getServerSnapshot,
  );
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
  const accountMap = useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id, account])),
    [accounts.data],
  );
  const lookups = useMemo<TransactionLookups>(
    () => ({ accounts: accountMap, categories: categoryMap }),
    [accountMap, categoryMap],
  );
  const series = useMemo(
    () =>
      stats.data && groupBy === "day"
        ? daySeries(stats.data.buckets, window, dates.timeZone, now, stats.data.total)
        : null,
    [stats.data, groupBy, window, dates.timeZone, now],
  );
  const highestKey = series?.highest?.key ?? null;
  const highestDate = highestKey ? dates.fromDayKey(highestKey) : null;
  const highestWindow = highestKey ? toIsoWindow(dates.dayKeyWindow(highestKey)) : null;
  const highestRows = useTransactionsInfinite(
    highestWindow ? { ...highestWindow, type } : {},
    highestWindow !== null,
  );
  const wantsBiggest = groupBy === "day" || groupBy === "account";
  const biggest = useBiggestTransactions({ ...iso, type }, wantsBiggest);
  // An empty page is not a state of its own here: the screen is already showing its own Empty.
  const showsBiggest = wantsBiggest && biggest.data?.data.length !== 0;

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
  function transactionsHref(extra: Record<string, string>) {
    return {
      pathname: "/transactions" as const,
      query: {
        period: "custom",
        from: dayKey(window.from, dates.timeZone),
        to: lastDay,
        type,
        ...extra,
      },
    };
  }
  function openTransactions(extra: Record<string, string>) {
    router.push(transactionsHref(extra));
  }

  const daySummary = highestDate
    ? {
        label: t("charts.highestDay", { day: dates.formatLong(highestDate) }),
        amount: money.format(series?.highest?.total ?? 0),
      }
    : undefined;
  function openDay(key: string) {
    openTransactions({ from: key, to: key });
  }

  const total = stats.data?.total ?? 0;
  const count = byCategory.data ? transactionCount(byCategory.data.buckets) : 0;
  const empty = stats.isSuccess && stats.data.buckets.length === 0;
  const categoryShares =
    stats.data && groupBy === "category" ? shares(stats.data.buckets, total) : [];
  const accountShares =
    stats.data && groupBy === "account" ? shares(stats.data.buckets, total) : [];
  const tagShares =
    stats.data && groupBy === "tag"
      ? shares(
          stats.data.buckets.filter((bucket) => bucket.key !== UNTAGGED_KEY),
          total,
        )
      : [];
  const untagged = stats.data?.buckets.find((bucket) => bucket.key === UNTAGGED_KEY)?.total ?? 0;

  const weekStart = weekStartFor(formatLocale);
  const weekdayNames = useWeekdayNames();
  const weekdays = useMemo(() => (series ? weekdayAverages(series.bars) : []), [series]);
  const weekdayBars = useMemo<Bar[]>(() => {
    const byWeekday = new Map(weekdays.map((entry) => [entry.weekday, entry]));
    return weekColumns(weekStart).map((weekday) => {
      const entry = byWeekday.get(weekday);
      const average = money.round(entry?.average ?? 0);
      return {
        value: average,
        label: t("charts.weekdaySlot", {
          weekday: weekdayNames.long(weekday),
          amount: money.format(average),
        }),
      };
    });
  }, [weekdays, weekStart, weekdayNames, money, t]);
  const peakWeekday = weekdays.reduce<(typeof weekdays)[number] | null>(
    (top, entry) => (top === null || entry.average > top.average ? entry : top),
    null,
  );

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
          {groupBy === "day" && (
            <>
              <Card className="flex flex-col gap-2">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="mt-[22px] h-[140px]" />
                <Skeleton className="h-3 w-3/5" />
              </Card>
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-[68px] rounded-lg" />
                <Skeleton className="h-[68px] rounded-lg" />
                <Skeleton className="h-[68px] rounded-lg" />
              </div>
              <Card className="flex flex-col gap-2">
                <Skeleton className="h-2.5 w-32" />
                <Skeleton className="mt-[22px] h-16" />
                <Skeleton className="h-3 w-1/2" />
              </Card>
            </>
          )}
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
          body={
            groupBy === "account"
              ? `${t("stats.empty.body")} ${t("stats.transfersNote")}`
              : t("stats.empty.body")
          }
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
                names={(key) =>
                  key === UNCATEGORIZED_KEY
                    ? t("stats.uncategorized")
                    : (categoryMap.get(key)?.name ?? t("stats.uncategorized"))
                }
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
          {groupBy === "account" && (
            <>
              <StackBar
                shares={accountShares}
                colors={(key) => accountMap.get(key)?.color ?? null}
                names={(key) => accountMap.get(key)?.name ?? t("stats.unassignedAccount")}
                label={t("stats.breakdownByAccount")}
              />
              <AccountRows
                shares={accountShares}
                type={type}
                accounts={accountMap}
                onOpen={(key) => {
                  openTransactions(key === UNASSIGNED_ACCOUNT_KEY ? {} : { account: key });
                }}
              />
              <p className="text-xs text-text-3">{t("stats.transfersNote")}</p>
            </>
          )}
          {groupBy === "day" && series && (
            <>
              <Card className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
                    {t("stats.perDay")}
                  </span>
                  <Segment<DayView>
                    inline
                    label={t("stats.dayView.label")}
                    value={view}
                    onChange={setDayView}
                    options={[
                      {
                        value: "bars",
                        label: <span className="sr-only">{t("stats.dayView.bars")}</span>,
                        icon: <ChartColumn {...iconProps("sm")} />,
                      },
                      {
                        value: "calendar",
                        label: <span className="sr-only">{t("stats.dayView.calendar")}</span>,
                        icon: <CalendarDays {...iconProps("sm")} />,
                      },
                    ]}
                  />
                </div>
                <Projected when={outbox.projected.spending} align="center" className="w-full">
                  {view === "calendar" ? (
                    <DayHeat
                      days={series.bars}
                      label={t("stats.perDay")}
                      summary={daySummary}
                      onOpen={openDay}
                      className="flex-1"
                    />
                  ) : (
                    <DayBars
                      days={series.bars}
                      label={t("stats.perDay")}
                      height={140}
                      summary={daySummary}
                      onOpen={openDay}
                      className="flex-1"
                    />
                  )}
                </Projected>
                {view === "bars" && (
                  <div className="flex justify-between text-xs text-text-3">
                    <span>{dates.formatDay(window.from)}</span>
                    <span>
                      {series.bars[14]
                        ? dates.formatDay(dates.fromDayKey(series.bars[14].key))
                        : ""}
                    </span>
                    <span>{dates.formatDay(new Date(window.to.getTime() - 1))}</span>
                  </div>
                )}
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
                  sub={highestDate ? dates.formatWeekdayDay(highestDate) : undefined}
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
              <Card className="flex flex-col gap-2">
                <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
                  {t("stats.weekdayAverage")}
                </span>
                <Projected when={outbox.projected.spending} align="center" className="w-full">
                  <Bars
                    bars={weekdayBars}
                    label={t("stats.weekdayAverage")}
                    height={64}
                    summary={
                      peakWeekday && peakWeekday.average > 0
                        ? {
                            label: t("stats.weekdayPeak", {
                              weekday: weekdayNames.long(peakWeekday.weekday),
                            }),
                            amount: money.format(money.round(peakWeekday.average)),
                          }
                        : { label: t("stats.weekdayNone") }
                    }
                    className="flex-1"
                  />
                </Projected>
                <div className="flex justify-between text-xs text-text-3">
                  {weekColumns(weekStart).map((weekday) => (
                    <span key={weekday}>{weekdayNames.short(weekday)}</span>
                  ))}
                </div>
              </Card>
              {highestDate && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-md font-semibold">
                      {t("stats.highest", { day: dates.formatWeekdayDay(highestDate) })}
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
          {showsBiggest && (
            <section aria-labelledby="stats-biggest" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 id="stats-biggest" className="text-md font-semibold">
                  {t("stats.biggest")}
                </h2>
                <Link href={transactionsHref({})} className="text-sm font-medium text-brand-text">
                  {t("common.seeAll")}
                </Link>
              </div>
              <Card flush>
                {biggest.isPending ? (
                  <div role="status" aria-busy="true" aria-label={t("common.loading")}>
                    <SkeletonRow />
                    <SkeletonRow />
                  </div>
                ) : biggest.isError ? (
                  <Empty
                    tone="danger"
                    icon={<ChartPie {...iconProps("lg")} />}
                    title={t("stats.biggestError")}
                    body={<LoadErrorBody error={biggest.error} />}
                    action={
                      <Button
                        onClick={() => {
                          void biggest.refetch();
                        }}
                      >
                        {t("common.retry")}
                      </Button>
                    }
                  />
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
