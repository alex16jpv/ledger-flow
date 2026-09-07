import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NewTransactionScreen } from "../TransactionFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.form");
  return { title: t("newTitle") };
}

export default function NewTransactionPage() {
  return (
    <Suspense>
      <NewTransactionScreen />
    </Suspense>
  );
}
