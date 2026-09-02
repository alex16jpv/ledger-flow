"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StepDots } from "@/components/ui/StepDots";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { GlobalBudgetForm } from "@/features/budgets/components/GlobalBudgetForm";
import { useBudgetsQuery } from "@/features/budgets/hooks";
import { isGlobalMonthlyBudget } from "@/features/home/hooks";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { useRouter } from "@/lib/i18n/navigation";

type Step = 1 | 2;

// Onboarding is complete when the user already has an account and a global monthly budget.
export function OnboardingFlow() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const accounts = useAccountsQuery();
  const budgets = useBudgetsQuery();
  const [step, setStep] = useState<Step | null>(null);

  const hasAccount = accounts.data !== undefined && accounts.data.length > 0;
  const hasGlobalBudget = budgets.data?.some(isGlobalMonthlyBudget) ?? false;
  const settled = accounts.data !== undefined && budgets.data !== undefined;
  const done = settled && hasAccount && hasGlobalBudget;

  useEffect(() => {
    if (done) router.replace(APP_HOME_PATH);
  }, [done, router]);

  const current: Step | null = step ?? (settled ? (hasAccount ? 2 : 1) : null);

  if (current === null || done) {
    return (
      <div aria-busy="true" className="flex flex-col gap-5">
        <Skeleton className="mx-auto h-1.5 w-10" />
        <Skeleton className="mx-auto h-7 w-56" />
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  const section = current === 1 ? "account" : "budget";

  return (
    <div className="flex flex-col gap-5">
      <StepDots current={current} total={2} label={t("step", { current, total: 2 })} />
      <div className="flex flex-col gap-2 text-center">
        <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
          {t("step", { current, total: 2 })}
        </span>
        <AuthHeading title={t(`${section}.title`)} subtitle={t(`${section}.subtitle`)} />
      </div>
      {current === 1 ? (
        <AccountForm
          submitLabel={t("account.submit")}
          onSaved={() => {
            setStep(2);
          }}
        />
      ) : (
        <GlobalBudgetForm
          submitLabel={t("budget.submit")}
          skipLabel={t("budget.skip")}
          onDone={() => {
            router.replace(APP_HOME_PATH);
          }}
        />
      )}
    </div>
  );
}
