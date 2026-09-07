import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditCategoryRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories.form");
  return { title: t("editTitle") };
}

export default function EditCategoryPage() {
  return <EditCategoryRoute />;
}
