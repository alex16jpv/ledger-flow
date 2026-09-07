import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ProfileScreen } from "../ProfileScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.credentials");
  return { title: t("pageTitle") };
}

export default function ProfilePage() {
  return <ProfileScreen />;
}
