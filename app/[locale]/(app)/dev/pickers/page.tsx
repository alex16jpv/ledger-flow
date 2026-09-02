import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isEnabled } from "@/lib/flags";

import { PickersPlayground } from "./PickersPlayground";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dev.pickersPlayground");
  return { title: t("title") };
}

export default function PickersPage() {
  if (!isEnabled("componentCatalog")) notFound();
  return <PickersPlayground />;
}
