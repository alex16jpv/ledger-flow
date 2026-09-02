"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { StepDots } from "@/components/ui/StepDots";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { GlobalBudgetForm } from "@/features/budgets/components/GlobalBudgetForm";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { useRouter } from "@/lib/i18n/navigation";

export function OnboardingFlow() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const section = step === 1 ? "account" : "budget";

  return (
    <div className="flex flex-col gap-5">
      <StepDots current={step} total={2} label={t("step", { current: step, total: 2 })} />
      <div className="flex flex-col gap-2 text-center">
        <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
          {t("step", { current: step, total: 2 })}
        </span>
        <AuthHeading title={t(`${section}.title`)} subtitle={t(`${section}.subtitle`)} />
      </div>
      {step === 1 ? (
        <AccountForm
          submitLabel={t("account.submit")}
          onCreated={() => {
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
