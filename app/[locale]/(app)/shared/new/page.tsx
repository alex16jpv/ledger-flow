import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GroupFormScreen } from "./GroupFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shared.form");
  return { title: t("groupTitle") };
}

export default function NewSharedGroupPage() {
  return <GroupFormScreen />;
}
