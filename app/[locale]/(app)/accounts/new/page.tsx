import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NewAccountScreen } from "../AccountFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts.form");
  return { title: t("title") };
}

export default function NewAccountPage() {
  return <NewAccountScreen />;
}
