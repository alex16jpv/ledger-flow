import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { TransactionsScreen } from "./TransactionsScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.list");
  return { title: t("title") };
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsScreen />
    </Suspense>
  );
}
