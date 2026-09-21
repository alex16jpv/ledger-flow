import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NewTransactionRoute } from "./NewTransactionRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.form");
  return { title: t("newTitle") };
}

export default function NewTransactionPage() {
  return (
    <Suspense>
      <NewTransactionRoute />
    </Suspense>
  );
}
