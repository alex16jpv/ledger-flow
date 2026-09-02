import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountDetailScreen } from "./AccountDetailScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts.detail");
  return { title: t("title") };
}

export default async function AccountDetailPage({ params }: PageProps<"/[locale]/accounts/[id]">) {
  const { id } = await params;
  return <AccountDetailScreen id={id} />;
}
