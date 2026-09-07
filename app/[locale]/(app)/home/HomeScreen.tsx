"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { GlobalBudgetForm } from "@/features/budgets/components/GlobalBudgetForm";
import { HomeView } from "@/features/home/components/HomeView";
import { homeKeys } from "@/features/home/keys";

import { RecentTransactions } from "./RecentTransactions";

type OpenSheet = "account" | "budget" | null;

export function HomeScreen() {
  const t = useTranslations();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<OpenSheet>(null);

  const close = () => {
    setOpen(null);
    void queryClient.invalidateQueries({ queryKey: homeKeys.all });
  };

  return (
    <>
      <HomeView
        reactivated={params.get("reactivated") === "1"}
        onCreateAccount={() => {
          setOpen("account");
        }}
        onCreateBudget={() => {
          setOpen("budget");
        }}
        recent={<RecentTransactions />}
      />
      <Sheet
        open={open === "account"}
        onClose={() => {
          setOpen(null);
        }}
        title={t("onboarding.account.title")}
      >
        <AccountForm submitLabel={t("home.empty.accounts.cta")} onSaved={close} />
      </Sheet>
      <Sheet
        open={open === "budget"}
        onClose={() => {
          setOpen(null);
        }}
        title={t("onboarding.budget.title")}
      >
        <GlobalBudgetForm
          submitLabel={t("onboarding.budget.submit")}
          skipLabel={t("common.cancel")}
          onDone={close}
        />
      </Sheet>
    </>
  );
}
