import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SharedGroupRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shared.group");
  return { title: t("title") };
}

export default function SharedGroupPage() {
  return <SharedGroupRoute />;
}
