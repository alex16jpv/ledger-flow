import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SyncStatusView } from "@/features/settings/components/SyncStatusView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sync");
  return { title: t("title") };
}

export default function SyncStatusPage() {
  return <SyncStatusView />;
}
