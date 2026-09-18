"use client";

import { Star, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, type ReactNode } from "react";

import { type DebtAccount, type DebtFoot, readDebt } from "@/lib/accounts/debt";
import { Link } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";
import type { Account } from "@/types/api";

import { Amount } from "./Amount";
import { Badge } from "./Badge";
import { buttonClasses } from "./Button";
import { cn } from "./cn";
import { Progress } from "./Progress";
import { Projected } from "./Projected";
import { Dot, Tile } from "./Tile";

export interface AccountCardDebt {
  word: ReactNode;
  bar: number | null;
  barLabel: string;
  foot?: ReactNode;
  action?: ReactNode;
}

export interface AccountCardProps {
  name: string;
  typeLabel: ReactNode;
  mark?: ReactNode;
  balance: ReactNode;
  color?: ColorToken | null;
  mainLabel?: ReactNode;
  archivedLabel?: ReactNode;
  href?: string;
  debt?: AccountCardDebt;
}

const CARD =
  "relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-1 before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-r-[3px] before:bg-(--f)";
const OPENS =
  "transition-[border-color] duration-(--dur-1) ease-(--ease) hover:border-border-strong focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none";
// Dims the contents, never the box: opacity on the focusable element dims its focus ring too.
const ARCHIVED = "[&>*]:opacity-60 before:opacity-60";

export function AccountCard({
  name,
  typeLabel,
  mark,
  balance,
  color,
  mainLabel,
  archivedLabel,
  href,
  debt,
}: AccountCardProps) {
  const stretched = debt?.action !== undefined && href !== undefined;
  const paint = cn(
    CARD,
    href !== undefined && !stretched && OPENS,
    archivedLabel ? ARCHIVED : null,
  );
  const body = (
    <>
      <div className="flex items-center gap-2">
        {mark ?? <Dot color={color} />}
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        {mainLabel && (
          <Badge tone="brand">
            <Star aria-hidden="true" />
            {mainLabel}
          </Badge>
        )}
        {archivedLabel && <Badge>{archivedLabel}</Badge>}
      </div>
      <div>
        <span className="block text-2xl font-semibold tracking-[-0.02em] tabular-nums">
          {balance}
        </span>
        <span className="block text-xs text-text-3">
          {debt ? (
            <>
              {debt.word} · {typeLabel}
            </>
          ) : (
            typeLabel
          )}
        </span>
      </div>
      {debt && (debt.bar !== null || debt.foot) && (
        <div className="flex flex-col gap-1.5">
          {debt.bar !== null && <Progress value={debt.bar} thin plain label={debt.barLabel} />}
          {debt.foot && <span className="text-xs text-text-3">{debt.foot}</span>}
        </div>
      )}
    </>
  );

  if (stretched) {
    return (
      <div className={paint} style={featureColorStyle(color)}>
        <Link
          href={href}
          aria-label={name}
          // The card clips its contents, so an inset outline is the ring that survives; a shadow is cut off.
          className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring)"
        />
        {body}
        <div className="relative self-start">{debt.action}</div>
      </div>
    );
  }

  return href === undefined ? (
    <div className={paint} style={featureColorStyle(color)}>
      {body}
    </div>
  ) : (
    <Link href={href} className={paint} style={featureColorStyle(color)}>
      {body}
    </Link>
  );
}

export function AccountCardGrid({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  // The horizontal carousel scrolls on small screens; a focusable region keeps it reachable by keyboard.
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 py-1 *:shrink-0 *:basis-[min(72%,260px)] *:snap-start",
        "sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:overflow-visible sm:px-0 sm:py-0 sm:*:basis-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AccountTypeTile({
  type,
  color,
}: {
  type: Account["type"];
  color?: ColorToken | null;
}) {
  return (
    <Tile size="sm" color={color}>
      {createElement(accountTypeIcon(type), iconProps("sm"))}
    </Tile>
  );
}

export interface AccountReading {
  lead: number;
  debt?: AccountCardDebt;
}

/** The one reading four surfaces print: the list, Home, the picker and the form's preview. */
export function useAccountReading(account: DebtAccount, promptHref?: string): AccountReading {
  const t = useTranslations();
  const money = useMoney();
  const reading = readDebt(account);
  if (reading === null) return { lead: account.balance };
  const footLine = (foot: DebtFoot): string => {
    if (foot.line === "owedOfLimit") {
      return t("accounts.debt.owedOfLimit", {
        owed: money.format(foot.owed),
        limit: money.format(foot.limit),
      });
    }
    if (foot.line === "paidOfBorrowed") {
      return t("accounts.debt.paidOfBorrowed", {
        paid: money.format(foot.paid),
        borrowed: money.format(foot.borrowed),
      });
    }
    return t("accounts.debt.inCredit", { amount: money.format(foot.amount) });
  };
  return {
    lead: reading.lead,
    debt: {
      word: t(`accounts.debt.${reading.word}`),
      bar: reading.bar,
      barLabel: t(
        reading.word === "available" ? "accounts.debt.barInUse" : "accounts.debt.barPaid",
      ),
      foot: reading.foot === null ? undefined : footLine(reading.foot),
      action:
        reading.missing === null || promptHref === undefined ? undefined : (
          <Link href={promptHref} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Target {...iconProps("sm")} />
            {reading.missing === "creditLimit"
              ? t("accounts.debt.setCreditLimit")
              : t("accounts.debt.setBorrowedAmount")}
          </Link>
        ),
    },
  };
}

export interface AccountRowCardProps {
  account: Account;
  href?: string;
  archived?: boolean;
  projected?: boolean;
  promptHref?: string;
}

export function AccountRowCard({
  account,
  href,
  archived = false,
  projected = false,
  promptHref,
}: AccountRowCardProps) {
  const t = useTranslations();
  const { lead, debt } = useAccountReading(account, promptHref);
  return (
    <AccountCard
      href={href}
      name={account.name}
      typeLabel={t(`accountTypes.${account.type}`)}
      mark={<AccountTypeTile type={account.type} color={account.color} />}
      balance={
        <Projected when={projected}>
          <Amount value={lead} signed={false} size="lg" />
        </Projected>
      }
      color={account.color}
      mainLabel={account.isDefault ? t("common.main") : undefined}
      archivedLabel={archived ? t("accounts.list.archivedBadge") : undefined}
      debt={debt}
    />
  );
}
