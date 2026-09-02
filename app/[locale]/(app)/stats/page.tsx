import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { StatsScreen } from "./StatsScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stats");
  return { title: t("title") };
}

export default function StatsPage() {
  return (
    <Suspense>
      <StatsScreen />
    </Suspense>
  );
}
