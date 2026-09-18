"use client";

import { useTranslations } from "next-intl";

import { AccountCardGrid, AccountRowCard } from "@/components/ui/AccountCard";
import { Link } from "@/lib/i18n/navigation";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Account } from "@/types/api";

interface AccountsSectionProps {
  accounts: Account[];
}

export function AccountsSection({ accounts }: AccountsSectionProps) {
  const t = useTranslations();
  const outbox = useOutbox();
  const ordered = [...accounts].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-md font-semibold">{t("home.accounts")}</h2>
        <Link href="/accounts" className="text-sm font-medium text-brand-text">
          {t("common.seeAll")}
        </Link>
      </div>
      <AccountCardGrid label={t("home.accounts")}>
        {ordered.map((account) => (
          <AccountRowCard
            key={account.id}
            account={account}
            href={`/accounts/${account.id}`}
            projected={outbox.projected.balances}
            promptHref={`/accounts/${account.id}/edit`}
          />
        ))}
      </AccountCardGrid>
    </section>
  );
}
