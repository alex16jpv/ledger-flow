"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement } from "react";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Projected } from "@/components/ui/Projected";
import { Tile } from "@/components/ui/Tile";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { featureColorStyle } from "@/lib/theme/feature-color";
import type { Account } from "@/types/api";

export function AccountHero({ account }: { account: Account }) {
  const t = useTranslations();
  const money = useMoney();
  const dates = useDates();
  const outbox = useOutbox();
  const archived = Boolean(account.archivedAt);
  return (
    <Card
      className={cn(
        "relative flex flex-col gap-2 overflow-hidden pl-5",
        "before:absolute before:top-4 before:bottom-4 before:left-0 before:w-[3px] before:rounded-r-[3px] before:bg-(--f)",
        archived && "opacity-70",
      )}
      style={featureColorStyle(account.color)}
    >
      <div className="flex items-start justify-between gap-3">
        <Tile color={account.color}>
          {createElement(accountTypeIcon(account.type), iconProps("md"))}
        </Tile>
        {account.isDefault && (
          <Badge tone="brand">
            <Star aria-hidden="true" />
            {t("common.main")}
          </Badge>
        )}
        {archived && <Badge>{t("accounts.list.archivedBadge")}</Badge>}
      </div>
      <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
        {t(`accountTypes.${account.type}`)}
      </span>
      <p className="text-lg font-semibold">{account.name}</p>
      <Projected when={outbox.projected.balances}>
        <Amount value={account.balance} signed={false} size="hero" />
      </Projected>
      <span className="text-sm text-text-3">
        {t("accounts.detail.openingLine", {
          amount: money.format(account.openingBalance),
          date: dates.formatDay(new Date(account.createdAt)),
          currency: account.currency,
        })}
      </span>
    </Card>
  );
}
