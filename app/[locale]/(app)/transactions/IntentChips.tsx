"use client";

import { useTranslations } from "next-intl";
import { createElement, useState } from "react";

import { Chip, ChipRow } from "@/components/ui/Chip";
import { AccountPickerSheet } from "@/features/accounts/components/AccountPickerSheet";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

const INTENTS = [
  { key: "card", types: new Set<Account["type"]>(["CARD", "OVERDRAFT"]) },
  { key: "loan", types: new Set<Account["type"]>(["LOAN"]) },
  { key: "savings", types: new Set<Account["type"]>(["SAVINGS"]) },
] as const satisfies readonly { key: string; types: ReadonlySet<Account["type"]> }[];

type Intent = (typeof INTENTS)[number];

const INTENT_ICON: Record<Intent["key"], Account["type"]> = {
  card: "CARD",
  loan: "LOAN",
  savings: "SAVINGS",
};

export function intentOf(to: Account | null | undefined): Intent["key"] | null {
  if (!to) return null;
  return INTENTS.find((intent) => intent.types.has(to.type))?.key ?? null;
}

export interface IntentChipsProps {
  accounts: readonly Account[];
  main: Account | null;
  to: Account | null;
  onFill: (sides: { from: Account | null; to: Account }) => void;
}

export function IntentChips({ accounts, main, to, onFill }: IntentChipsProps) {
  const t = useTranslations();
  const [asking, setAsking] = useState<Intent | null>(null);
  const selected = intentOf(to);
  const offered = INTENTS.map((intent) => ({
    intent,
    targets: accounts.filter((account) => intent.types.has(account.type)),
  })).filter(({ targets }) => targets.length > 0);

  if (offered.length === 0) return null;

  function fill(target: Account) {
    onFill({ from: main && main.id !== target.id ? main : null, to: target });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-text-2">{t("transactions.form.intent")}</span>
        <span className="text-text-3">{t("common.optional")}</span>
      </span>
      <ChipRow role="group" aria-label={t("transactions.form.intent")}>
        {offered.map(({ intent, targets }) => (
          <Chip
            key={intent.key}
            selected={selected === intent.key}
            icon={createElement(accountTypeIcon(INTENT_ICON[intent.key]), iconProps("sm"))}
            aria-haspopup={targets.length > 1 ? "dialog" : undefined}
            onClick={() => {
              const only = targets[0];
              if (targets.length === 1 && only) fill(only);
              else setAsking(intent);
            }}
          >
            {t(`transactions.form.intents.${intent.key}`)}
          </Chip>
        ))}
      </ChipRow>
      <AccountPickerSheet
        open={asking !== null}
        value={to?.id ?? null}
        only={asking?.types}
        allowCreate={false}
        onSelect={fill}
        onClose={() => {
          setAsking(null);
        }}
      />
    </div>
  );
}
