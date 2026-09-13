import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { TrendsScreen } from "./TrendsScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("trends");
  return { title: t("title") };
}

export default function TrendsPage() {
  return (
    <Suspense>
      <TrendsScreen />
    </Suspense>
  );
}
