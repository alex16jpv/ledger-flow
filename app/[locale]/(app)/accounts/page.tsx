import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountsView } from "@/features/accounts/components/AccountsView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts.list");
  return { title: t("title") };
}

export default function AccountsPage() {
  return <AccountsView />;
}
