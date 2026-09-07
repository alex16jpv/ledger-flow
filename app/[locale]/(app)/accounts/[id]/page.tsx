import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountDetailRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts.detail");
  return { title: t("title") };
}

export default function AccountDetailPage() {
  return <AccountDetailRoute />;
}
