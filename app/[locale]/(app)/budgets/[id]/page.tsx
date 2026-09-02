import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { BudgetDetailScreen } from "./BudgetDetailScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("budgets.detail");
  return { title: t("title") };
}

export default async function BudgetDetailPage({ params }: PageProps<"/[locale]/budgets/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <BudgetDetailScreen id={id} />
    </Suspense>
  );
}
