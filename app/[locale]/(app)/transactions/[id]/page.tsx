import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TransactionDetailScreen } from "./TransactionDetailScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.detail");
  return { title: t("title") };
}

export default async function TransactionDetailPage({
  params,
}: PageProps<"/[locale]/transactions/[id]">) {
  const { id } = await params;
  return <TransactionDetailScreen id={id} />;
}
