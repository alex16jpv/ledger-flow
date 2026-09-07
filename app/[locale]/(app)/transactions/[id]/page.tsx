import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TransactionDetailRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.detail");
  return { title: t("title") };
}

export default function TransactionDetailPage() {
  return <TransactionDetailRoute />;
}
