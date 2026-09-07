import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PastBudgetsScreen } from "../BudgetsScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("budgets.past");
  return { title: t("title") };
}

export default function PastBudgetsPage() {
  return (
    <Suspense>
      <PastBudgetsScreen />
    </Suspense>
  );
}
