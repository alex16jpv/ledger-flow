"use client";

import { Info, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";

import { Avatar, PageHeader } from "@/components/shell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useSession } from "@/lib/session";

import { dayBars, topBudgets, useHomeData, useMonthContext } from "../hooks";
import { AccountsSection } from "./AccountsSection";
import { BudgetsSection } from "./BudgetsSection";
import { HeroCard } from "./HeroCard";
import { StatsRow } from "./StatsRow";

interface HomeViewProps {
  reactivated?: boolean;
  onCreateAccount: () => void;
  onCreateBudget: () => void;
  recent?: ReactNode;
}

export function HomeView({
  reactivated = false,
  onCreateAccount,
  onCreateBudget,
  recent,
}: HomeViewProps) {
  const t = useTranslations();
  const { user } = useSession();
  const dates = useDates();
  const money = useMoney();
  const month = useMonthContext();
  const data = useHomeData(month);
  const firstName = user?.name.split(" ")[0] ?? "";
  const categoriesById = useMemo(
    () => new Map((data.categories.data ?? []).map((category) => [category.id, category])),
    [data.categories.data],
  );
  const pending = data.pending.data;

  const header = (
    <PageHeader
      eyebrow={dates.formatLong(month.reference)}
      title={t("home.greeting", { name: firstName })}
      actions={
        <Link href="/settings" aria-label={t("nav.settings")} className="rounded-full">
          <Avatar name={user?.name ?? ""} />
        </Link>
      }
    />
  );

  if (data.error) {
    return (
      <>
        {header}
        <Card>
          <Empty
            tone="danger"
            icon={<Info {...iconProps("lg")} />}
            title={t("states.error.title")}
            body={<LoadErrorBody error={data.error} />}
            action={
              <Button variant="secondary" onClick={() => void data.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  if (data.isLoading || !data.accounts.data || !data.spending.data) {
    return (
      <>
        {header}
        <div aria-busy="true" className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-1.5 w-full" />
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <Skeleton className="h-12 w-full" />
            </Card>
            <Card>
              <Skeleton className="h-12 w-full" />
            </Card>
          </div>
          <Card flush>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        </div>
      </>
    );
  }

  const accounts = data.accounts.data;
  const spent = data.spending.data.total;
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <>
      {header}
      {reactivated && (
        <Alert tone="info" title={t("auth.register.reactivated.title")}>
          {t("auth.register.reactivated.body")}
        </Alert>
      )}
      {pending && pending.count > 0 && (
        <Link href="/transactions/review" className="block rounded-md">
          <Alert tone="warning">
            <b className="font-semibold">{t("home.pendingReview", { count: pending.count })}</b>
            {pending.total > 0 &&
              ` ${t("home.pendingTotal", { amount: money.format(pending.total) })}`}
          </Alert>
        </Link>
      )}
      {accounts.length === 0 ? (
        <Card>
          <Empty
            icon={<Wallet {...iconProps("lg")} />}
            title={t("home.empty.accounts.title")}
            body={t("home.empty.accounts.body")}
            action={<Button onClick={onCreateAccount}>{t("home.empty.accounts.cta")}</Button>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] md:items-start md:gap-5">
          <div className="contents md:flex md:flex-col md:gap-5">
            <HeroCard
              month={month}
              spent={spent}
              yesterdaySpent={data.yesterdaySpent}
              globalBudget={data.globalBudget}
              bars={dayBars(data.spending.data.buckets, month, dates.timeZone)}
              onCreateBudget={onCreateBudget}
            />
            <StatsRow
              totalBalance={totalBalance}
              accountCount={accounts.length}
              income={data.income.data ?? 0}
              spent={spent}
            />
            <div className="order-5 md:order-none">{recent}</div>
          </div>
          <div className="contents md:flex md:flex-col md:gap-5">
            <BudgetsSection
              budgets={topBudgets(data.budgets.data ?? [])}
              categories={categoriesById}
              now={month.reference}
            />
            <AccountsSection accounts={accounts} />
          </div>
        </div>
      )}
    </>
  );
}
