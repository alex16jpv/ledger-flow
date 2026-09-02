"use client";

import { Info, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, PageHeader } from "@/components/shell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";
import { useSession } from "@/lib/session";

import { useHomeData, useMonthContext } from "../hooks";
import { AccountsSection } from "./AccountsSection";
import { HeroCard } from "./HeroCard";
import { StatsRow } from "./StatsRow";

interface HomeViewProps {
  reactivated?: boolean;
  onCreateAccount: () => void;
  onCreateBudget: () => void;
}

export function HomeView({ reactivated = false, onCreateAccount, onCreateBudget }: HomeViewProps) {
  const t = useTranslations();
  const { user } = useSession();
  const dates = useDates();
  const month = useMonthContext();
  const data = useHomeData(month);
  const firstName = user?.name.split(" ")[0] ?? "";

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
    const requestId =
      data.error instanceof ApiError || data.error instanceof NetworkError
        ? data.error.requestId
        : null;
    return (
      <>
        {header}
        <Card>
          <Empty
            tone="danger"
            icon={<Info {...iconProps("lg")} />}
            title={t("states.error.title")}
            body={
              <>
                {t("states.error.body")}
                {requestId && (
                  <span className="mt-1 block font-mono text-xs text-text-3">
                    {t("states.error.reference", { requestId })}
                  </span>
                )}
              </>
            }
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
          <div className="flex flex-col gap-5">
            <HeroCard
              month={month}
              spent={spent}
              yesterdaySpent={data.yesterdaySpent}
              globalBudget={data.globalBudget}
              onCreateBudget={onCreateBudget}
            />
            <StatsRow
              totalBalance={totalBalance}
              accountCount={accounts.length}
              income={data.income.data ?? 0}
              spent={spent}
            />
          </div>
          <div className="flex flex-col gap-5">
            <AccountsSection accounts={accounts} />
          </div>
        </div>
      )}
    </>
  );
}
