import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SessionsScreen } from "../SessionsScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sessions");
  return { title: t("title") };
}

export default function SessionsPage() {
  return <SessionsScreen />;
}
