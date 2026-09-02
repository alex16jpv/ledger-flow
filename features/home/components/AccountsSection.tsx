"use client";

import { useTranslations } from "next-intl";

import { AccountCard, AccountCardGrid } from "@/components/ui/AccountCard";
import { Amount } from "@/components/ui/Amount";
import { Link } from "@/lib/i18n/navigation";
import type { Account } from "@/types/api";

interface AccountsSectionProps {
  accounts: Account[];
}

export function AccountsSection({ accounts }: AccountsSectionProps) {
  const t = useTranslations();
  const ordered = [...accounts].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-md font-semibold">{t("home.accounts")}</h2>
        <Link href="/accounts" className="text-sm font-medium text-brand-text">
          {t("common.seeAll")}
        </Link>
      </div>
      <AccountCardGrid>
        {ordered.map((account) => (
          <AccountCard
            key={account.id}
            name={account.name}
            typeLabel={t(`accountTypes.${account.type}`)}
            balance={<Amount value={account.balance} signed={false} size="lg" />}
            color={account.color}
            mainLabel={account.isDefault ? t("home.main") : undefined}
          />
        ))}
      </AccountCardGrid>
    </section>
  );
}
