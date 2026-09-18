"use client";

import { ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { DEBT_ACCOUNT_TYPES } from "@/lib/accounts/debt";
import { useMoney } from "@/lib/i18n/useMoney";
import type { Account } from "@/types/api";

type ReadbackAccount = Pick<Account, "name" | "type" | "balance">;

export type SideKey = "leaves" | "arrives" | "lessOwed" | "moreOwed";

// A card or a loan can hold money of your own, and then there is no debt to say less or more of.
export function sideKey(account: ReadbackAccount, arrives: boolean): SideKey {
  const owing = DEBT_ACCOUNT_TYPES.has(account.type) && account.balance < 0;
  if (!owing) return arrives ? "arrives" : "leaves";
  return arrives ? "lessOwed" : "moreOwed";
}

export interface TransferReadbackProps {
  from: ReadbackAccount | null | undefined;
  to: ReadbackAccount | null | undefined;
  amount: number | null;
}

export function TransferReadback({ from, to, amount }: TransferReadbackProps) {
  const t = useTranslations("transactions.readback");
  const money = useMoney();
  if (!from || !to || amount === null || !Number.isFinite(amount) || amount <= 0) return null;
  const formatted = money.format(amount);

  return (
    <Alert tone="neutral" icon={ArrowLeftRight}>
      {t("line", {
        left: t(sideKey(from, false), { name: from.name, amount: formatted }),
        right: t(sideKey(to, true), { name: to.name, amount: formatted }),
      })}
    </Alert>
  );
}
