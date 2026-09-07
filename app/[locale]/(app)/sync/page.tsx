import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AttentionScreen } from "./AttentionScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("states.attention");
  return { title: t("title") };
}

export default function SyncAttentionPage() {
  return <AttentionScreen />;
}
