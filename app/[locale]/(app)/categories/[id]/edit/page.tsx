import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditCategoryScreen } from "../../CategoryFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories.form");
  return { title: t("editTitle") };
}

export default async function EditCategoryPage({
  params,
}: PageProps<"/[locale]/categories/[id]/edit">) {
  const { id } = await params;
  return <EditCategoryScreen id={id} />;
}
