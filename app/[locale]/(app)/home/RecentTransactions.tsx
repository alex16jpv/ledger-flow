"use client";

import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { ADD_HREF } from "@/components/shell";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { List } from "@/components/ui/Row";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery } from "@/features/categories/hooks";
import {
  type TransactionLookups,
  TransactionRow,
} from "@/features/transactions/components/TransactionRow";
import { useRecentTransactions } from "@/features/transactions/hooks";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

export function RecentTransactions() {
  const t = useTranslations();
  const router = useRouter();
  const recent = useRecentTransactions();
  const accounts = useAccountsQuery(true);
  const categories = useCategoriesQuery(undefined);
  const lookups = useMemo<TransactionLookups>(
    () => ({
      accounts: new Map((accounts.data ?? []).map((account) => [account.id, account])),
      categories: new Map((categories.data ?? []).map((category) => [category.id, category])),
    }),
    [accounts.data, categories.data],
  );

  return (
    <section aria-labelledby="home-recent" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 id="home-recent" className="text-md font-semibold">
          {t("home.recent")}
        </h2>
        <Link href="/transactions" className="text-sm font-medium text-brand-text">
          {t("common.seeAll")}
        </Link>
      </div>
      <Card flush>
        {recent.isPending ? (
          <div aria-busy="true" aria-label={t("common.loading")}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : recent.error || !recent.rows ? (
          <Empty
            tone="danger"
            icon={<Inbox {...iconProps("lg")} />}
            title={t("states.error.title")}
            body={t("states.error.body")}
          />
        ) : recent.rows.length === 0 ? (
          <Empty
            icon={<Inbox {...iconProps("lg")} />}
            title={t("transactions.list.empty.title")}
            action={
              <Link href={ADD_HREF} className={buttonClasses({ size: "sm" })}>
                {t("transactions.list.empty.cta")}
              </Link>
            }
          />
        ) : (
          <List>
            {recent.rows.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                lookups={lookups}
                onOpen={(row) => {
                  router.push(`/transactions/${row.id}`);
                }}
              />
            ))}
          </List>
        )}
      </Card>
    </section>
  );
}
