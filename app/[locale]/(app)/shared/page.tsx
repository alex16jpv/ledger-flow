import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SharedView } from "@/features/shared/components/SharedView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shared");
  return { title: t("title") };
}

export default function SharedPage() {
  return (
    <Suspense>
      <SharedView />
    </Suspense>
  );
}
