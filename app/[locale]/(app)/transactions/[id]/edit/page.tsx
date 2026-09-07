import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditTransactionRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transactions.form");
  return { title: t("editTitle") };
}

export default function EditTransactionPage() {
  return <EditTransactionRoute />;
}
