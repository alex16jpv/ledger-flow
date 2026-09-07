import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { OnboardingFlow } from "./OnboardingFlow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.account");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
