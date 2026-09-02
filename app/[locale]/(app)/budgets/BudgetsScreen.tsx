"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { BudgetsView } from "@/features/budgets/components/BudgetsView";
import { GlobalBudgetForm } from "@/features/budgets/components/GlobalBudgetForm";
import { PastBudgetsView, type PastTab } from "@/features/budgets/components/PastBudgetsView";
import { BUDGET_PERIOD_TYPES, type BudgetPeriodType } from "@/features/budgets/progress";
import { parseMonthKey } from "@/features/budgets/reference";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useRouter } from "@/lib/i18n/navigation";

function parsePeriod(value: string | null): BudgetPeriodType | null {
  return (BUDGET_PERIOD_TYPES as readonly string[]).includes(value ?? "")
    ? (value as BudgetPeriodType)
    : null;
}

function useCategoryMap() {
  const categories = useCategoriesQuery(undefined, true, true);
  return useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );
}

export function BudgetsScreen() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const { timeZone } = useFormatSettings();
  const [now] = useState(() => new Date());
  const monthKey = parseMonthKey(params.get("reference"), now, timeZone);
  const period = parsePeriod(params.get("period"));
  const categories = useCategoryMap();
  const [creating, setCreating] = useState(false);

  function apply(next: { reference?: string; period?: BudgetPeriodType | null }) {
    const reference = next.reference ?? monthKey;
    const nextPeriod = next.period === undefined ? period : next.period;
    router.replace({
      pathname: "/budgets",
      query: {
        ...(reference === parseMonthKey(null, now, timeZone) ? {} : { reference }),
        ...(nextPeriod ? { period: nextPeriod } : {}),
      },
    });
  }

  return (
    <>
      <BudgetsView
        monthKey={monthKey}
        periodFilter={period}
        categories={categories}
        now={now}
        onMonthChange={(reference) => {
          apply({ reference });
        }}
        onPeriodFilterChange={(next) => {
          apply({ period: next });
        }}
        onCreateGlobal={() => {
          setCreating(true);
        }}
      />
      <Sheet
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
        title={t("onboarding.budget.title")}
      >
        <GlobalBudgetForm
          submitLabel={t("onboarding.budget.submit")}
          skipLabel={t("common.cancel")}
          onDone={() => {
            setCreating(false);
          }}
        />
      </Sheet>
    </>
  );
}

export function PastBudgetsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: PastTab = params.get("tab") === "archived" ? "archived" : "ended";
  const categories = useCategoryMap();
  return (
    <PastBudgetsView
      tab={tab}
      categories={categories}
      onTabChange={(next) => {
        router.replace({ pathname: "/budgets/past", query: next === "ended" ? {} : { tab: next } });
      }}
      onBack={() => {
        router.push("/budgets");
      }}
    />
  );
}
