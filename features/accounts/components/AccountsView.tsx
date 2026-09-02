"use client";

import { ChevronDown, Plus, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { AccountCard } from "@/components/ui/AccountCard";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

import { useAccountsQuery } from "../hooks";
import { summarizeAccounts } from "../summary";

const NEW_HREF = "/accounts/new";
const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

function AccountLink({ account, archived = false }: { account: Account; archived?: boolean }) {
  const t = useTranslations();
  return (
    <Link
      href={`/accounts/${account.id}`}
      className="block rounded-lg focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none"
    >
      <AccountCard
        name={account.name}
        typeLabel={t(`accountTypes.${account.type}`)}
        balance={<Amount value={account.balance} signed={false} size="lg" />}
        color={account.color}
        mainLabel={account.isDefault ? t("common.main") : undefined}
        archivedLabel={archived ? t("accounts.list.archivedBadge") : undefined}
        className="h-full transition-[border-color] duration-(--dur-1) ease-(--ease) hover:border-border-strong"
      />
    </Link>
  );
}

export function AccountsView() {
  const t = useTranslations();
  const accounts = useAccountsQuery(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const archivedId = useId();
  const summary = useMemo(() => summarizeAccounts(accounts.data ?? []), [accounts.data]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("accounts.list.title")}
        actions={
          <>
            <span className="md:hidden">
              <Link
                href={NEW_HREF}
                aria-label={t("accounts.list.new")}
                className={buttonClasses({ variant: "secondary", iconOnly: true, round: true })}
              >
                <Plus {...iconProps("md")} />
              </Link>
            </span>
            <span className="hidden md:inline-flex">
              <Link href={NEW_HREF} className={buttonClasses({})}>
                <Plus {...iconProps("sm")} />
                {t("accounts.list.new")}
              </Link>
            </span>
          </>
        }
      />
      {accounts.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-3 w-40" />
          </Card>
          <div className={GRID}>
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className="flex flex-col gap-3">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-7 w-3/5" />
                <Skeleton className="h-2.5 w-1/4" />
              </Card>
            ))}
          </div>
        </div>
      ) : accounts.isError ? (
        <Empty
          tone="danger"
          icon={<Wallet {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={t("states.error.body")}
          action={
            <Button
              onClick={() => {
                void accounts.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : summary.active.length === 0 && summary.archived.length === 0 ? (
        <Empty
          icon={<Wallet {...iconProps("lg")} />}
          title={t("accounts.list.empty.title")}
          body={t("accounts.list.empty.body")}
          action={
            <Link href={NEW_HREF} className={buttonClasses({})}>
              {t("accounts.list.empty.cta")}
            </Link>
          }
        />
      ) : (
        <>
          <Card className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-3">
                {t("accounts.list.totalBalance")}
              </span>
              <Amount value={summary.totalBalance} signed={false} size="hero" />
              <span className="text-sm text-text-3">
                {t("accounts.list.counts", {
                  active: summary.active.length,
                  archived: summary.archived.length,
                })}
              </span>
            </div>
            {summary.cardDebt < 0 && (
              <div className="flex flex-col gap-1 sm:items-end">
                <span className="text-xs font-medium text-text-3">
                  {t("accounts.list.cardDebt")}
                </span>
                <Amount value={summary.cardDebt} size="lg" />
              </div>
            )}
          </Card>
          {summary.active.length > 0 && (
            <div className={GRID}>
              {summary.active.map((account) => (
                <AccountLink key={account.id} account={account} />
              ))}
            </div>
          )}
          {summary.archived.length > 0 && (
            <section className="flex flex-col gap-3">
              <Card flush>
                <button
                  type="button"
                  aria-expanded={archivedOpen}
                  aria-controls={archivedId}
                  onClick={() => {
                    setArchivedOpen((open) => !open);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium hover:bg-surface-2"
                >
                  <span className="flex-1">{t("accounts.list.archived")}</span>
                  <Badge>{summary.archived.length}</Badge>
                  <ChevronDown
                    {...iconProps("md")}
                    className={cn(
                      "text-text-3 transition-transform duration-(--dur-1) ease-(--ease)",
                      archivedOpen && "rotate-180",
                    )}
                  />
                </button>
              </Card>
              <div id={archivedId} hidden={!archivedOpen} className={GRID}>
                {summary.archived.map((account) => (
                  <AccountLink key={account.id} account={account} archived />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
