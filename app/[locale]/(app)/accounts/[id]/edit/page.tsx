import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditAccountRoute } from "./DetailRoute";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts.form");
  return { title: t("editTitle") };
}

export default function EditAccountPage() {
  return <EditAccountRoute />;
}
