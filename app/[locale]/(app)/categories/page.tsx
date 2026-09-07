import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CategoriesView } from "@/features/categories/components/CategoriesView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories.list");
  return { title: t("title") };
}

export default function CategoriesPage() {
  return (
    <Suspense>
      <CategoriesView />
    </Suspense>
  );
}
