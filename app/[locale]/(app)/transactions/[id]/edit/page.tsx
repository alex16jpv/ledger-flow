import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditTransactionScreen } from "../../TransactionFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.form");
  return { title: t("editTitle") };
}

export default async function EditTransactionPage({
  params,
}: PageProps<"/[locale]/transactions/[id]/edit">) {
  const { id } = await params;
  return <EditTransactionScreen id={id} />;
}
