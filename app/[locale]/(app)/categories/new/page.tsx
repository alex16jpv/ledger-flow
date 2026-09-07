import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NewCategoryScreen } from "../CategoryFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories.form");
  return { title: t("title") };
}

export default function NewCategoryPage() {
  return (
    <Suspense>
      <NewCategoryScreen />
    </Suspense>
  );
}
