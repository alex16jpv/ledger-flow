"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Link } from "@/lib/i18n/navigation";

interface PendingAlertProps {
  count: number;
  expense: number;
  income: number;
}

export function PendingAlert({ count, expense, income }: PendingAlertProps) {
  const t = useTranslations();
  return (
    <Link href="/transactions/review" className="block rounded-md">
      <Alert tone="warning">
        <b className="font-semibold">{t("home.pendingReview", { count })}</b>
        {expense > 0 && (
          <>
            {" · "}
            <Amount value={expense} kind="expense" size="sm" mutedParts={false} />
          </>
        )}
        {income > 0 && (
          <>
            {" · "}
            <Amount value={income} kind="income" size="sm" mutedParts={false} />
          </>
        )}
      </Alert>
    </Link>
  );
}
