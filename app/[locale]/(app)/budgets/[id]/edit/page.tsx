import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditBudgetScreen } from "../../BudgetFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("budgets.form");
  return { title: t("editTitle") };
}

export default async function EditBudgetPage({ params }: PageProps<"/[locale]/budgets/[id]/edit">) {
  const { id } = await params;
  return <EditBudgetScreen id={id} />;
}
