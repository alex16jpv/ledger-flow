import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EditAccountScreen } from "../../AccountFormScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts.form");
  return { title: t("editTitle") };
}

export default async function EditAccountPage({
  params,
}: PageProps<"/[locale]/accounts/[id]/edit">) {
  const { id } = await params;
  return <EditAccountScreen id={id} />;
}
