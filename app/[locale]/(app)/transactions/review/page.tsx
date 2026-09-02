import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ReviewScreen } from "./ReviewScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.review");
  return { title: t("title") };
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewScreen />
    </Suspense>
  );
}
