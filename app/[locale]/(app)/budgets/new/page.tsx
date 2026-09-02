import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NewBudgetScreen } from "../BudgetFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("budgets.form");
  return { title: t("newTitle") };
}

export default function NewBudgetPage() {
  return (
    <Suspense>
      <NewBudgetScreen />
    </Suspense>
  );
}
