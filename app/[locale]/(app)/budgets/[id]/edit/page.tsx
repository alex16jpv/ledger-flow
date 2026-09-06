import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditBudgetRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("budgets.form");
  return { title: t("editTitle") };
}

export default function EditBudgetPage() {
  return <EditBudgetRoute />;
}
