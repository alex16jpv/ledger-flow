import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { JoinedGroupRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shared.joined");
  return { title: t("title") };
}

export default function JoinedGroupPage() {
  return <JoinedGroupRoute />;
}
