import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PersonRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shared.person");
  return { title: t("title") };
}

export default function PersonPage() {
  return <PersonRoute />;
}
