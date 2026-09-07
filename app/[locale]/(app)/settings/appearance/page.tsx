import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppearanceView } from "@/features/settings/components/AppearanceView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.appearance");
  return { title: t("title") };
}

export default function AppearancePage() {
  return <AppearanceView />;
}
