import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { BudgetDetailRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("budgets.detail");
  return { title: t("title") };
}

export default function BudgetDetailPage() {
  return (
    <Suspense>
      <BudgetDetailRoute />
    </Suspense>
  );
}
