"use client";

import { Hash, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, type ReactNode } from "react";

import { Amount, type AmountKind } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Projected } from "@/components/ui/Projected";
import { List, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { Tooltip } from "@/components/ui/Tooltip";
import { useMoney } from "@/lib/i18n/useMoney";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";
import type { Account, Category } from "@/types/api";

import type { StatsType } from "../api";
import { type Share, UNASSIGNED_ACCOUNT_KEY, UNCATEGORIZED_KEY } from "../model";

export const AMOUNT_KIND: Record<StatsType, AmountKind> = {
  EXPENSE: "expense",
  INCOME: "income",
  TRANSFER: "transfer",
  ADJUSTMENT: "adjustment",
};

export function TotalCard({
  type,
  total,
  count,
  average,
}: {
  type: StatsType;
  total: number;
  count: number;
  average: number;
}) {
  const t = useTranslations("stats");
  const money = useMoney();
  const outbox = useOutbox();
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
        {t(`totals.${type}`)}
      </span>
      <Projected when={outbox.projected.spending}>
        <Amount value={total} signed={false} size="hero" kind={AMOUNT_KIND[type]} />
      </Projected>
      <span className="text-sm text-text-3">
        {t("summary", { count, average: money.format(money.round(average)) })}
      </span>
    </Card>
  );
}

export function StackBar({
  shares,
  colors,
  names,
  label,
}: {
  shares: readonly Share[];
  colors: (key: string) => ColorToken | null;
  names: (key: string) => string;
  label: string;
}) {
  return (
    <Card className="p-3">
      <div role="img" aria-label={label} className="flex h-2.5 gap-0.5 rounded-full">
        {shares.map((share) => (
          <Tooltip
            key={share.key}
            label={names(share.key)}
            className="h-full min-w-0"
            style={{ width: `${share.share * 100}%` }}
          >
            <span
              className={cn(
                "block h-full w-full rounded-[2px]",
                colors(share.key) ? "bg-(--f)" : "bg-surface-3",
              )}
              style={featureColorStyle(colors(share.key))}
            />
          </Tooltip>
        ))}
      </div>
    </Card>
  );
}

interface ShareRow {
  share: Share;
  name: string;
  color: ColorToken | null;
  icon: ReactNode;
  badge?: ReactNode;
}

function ShareRows({
  rows,
  type,
  onOpen,
}: {
  rows: readonly ShareRow[];
  type: StatsType;
  onOpen: (key: string) => void;
}) {
  const t = useTranslations("stats");
  return (
    <Card flush>
      <List>
        {rows.map((row) => (
          <RowButton
            key={row.share.key}
            onClick={() => {
              onOpen(row.share.key);
            }}
          >
            {row.color ? (
              <Tile color={row.color}>{row.icon}</Tile>
            ) : (
              <Tile className="bg-surface-2 text-text-2">{row.icon}</Tile>
            )}
            <RowBody>
              <RowTitle>
                <span>{row.name}</span>
                {row.badge}
              </RowTitle>
              <span className="flex items-center gap-2">
                <span
                  className="h-1 w-24 overflow-hidden rounded-full bg-surface-3"
                  style={featureColorStyle(row.color)}
                >
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      row.color ? "bg-(--f)" : "bg-text-3",
                    )}
                    style={{ width: `${Math.round(row.share.share * 100)}%` }}
                  />
                </span>
                <RowMeta items={[t("share", { percent: Math.round(row.share.share * 100) })]} />
              </span>
            </RowBody>
            <RowRight sub={t("txns", { count: row.share.count })}>
              <Amount value={row.share.total} kind={AMOUNT_KIND[type]} />
            </RowRight>
          </RowButton>
        ))}
      </List>
    </Card>
  );
}

export function CategoryRows({
  shares,
  type,
  categories,
  onOpen,
}: {
  shares: readonly Share[];
  type: StatsType;
  categories: ReadonlyMap<string, Category>;
  onOpen: (key: string) => void;
}) {
  const t = useTranslations("stats");
  const rows = shares.map((share) => {
    const category = categories.get(share.key);
    const uncategorized = share.key === UNCATEGORIZED_KEY;
    return {
      share,
      name: uncategorized ? t("uncategorized") : (category?.name ?? t("unknownCategory")),
      color: category?.color ?? null,
      icon: category ? <CategoryIcon icon={category.icon} /> : <Hash {...iconProps("md")} />,
      badge: category?.archivedAt ? <Badge tone="warning">{t("archived")}</Badge> : undefined,
    };
  });
  return <ShareRows rows={rows} type={type} onOpen={onOpen} />;
}

export function AccountRows({
  shares,
  type,
  accounts,
  onOpen,
}: {
  shares: readonly Share[];
  type: StatsType;
  accounts: ReadonlyMap<string, Account>;
  onOpen: (key: string) => void;
}) {
  const t = useTranslations("stats");
  const rows = shares.map((share) => {
    const account = accounts.get(share.key);
    const unassigned = share.key === UNASSIGNED_ACCOUNT_KEY;
    return {
      share,
      name: account?.name ?? t(unassigned ? "unassignedAccount" : "unknownAccount"),
      color: account?.color ?? null,
      icon: createElement(account ? accountTypeIcon(account.type) : Wallet, iconProps("md")),
      badge: account?.archivedAt ? <Badge tone="warning">{t("archived")}</Badge> : undefined,
    };
  });
  return <ShareRows rows={rows} type={type} onOpen={onOpen} />;
}

export function TagRows({
  shares,
  type,
  onOpen,
}: {
  shares: readonly Share[];
  type: StatsType;
  onOpen: (tag: string) => void;
}) {
  const t = useTranslations("stats");
  return (
    <Card flush>
      <List>
        {shares.map((share) => (
          <RowButton
            key={share.key}
            onClick={() => {
              onOpen(share.key);
            }}
          >
            <Tile className="bg-surface-2 text-text-2">
              <Hash {...iconProps("md")} />
            </Tile>
            <RowBody>
              <RowTitle>
                <span>{t("tagRow", { tag: share.key })}</span>
              </RowTitle>
              <RowMeta items={[t("transactionsCount", { count: share.count })]} />
            </RowBody>
            <RowRight>
              <Amount value={share.total} kind={AMOUNT_KIND[type]} />
            </RowRight>
          </RowButton>
        ))}
      </List>
    </Card>
  );
}

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1 p-3">
      <span className="text-xs text-text-3">{label}</span>
      <span className="text-lg font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      {sub && <span className="text-xs text-text-3">{sub}</span>}
    </Card>
  );
}
