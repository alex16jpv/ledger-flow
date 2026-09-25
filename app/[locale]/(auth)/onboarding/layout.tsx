import type { ReactNode } from "react";

import { ScopedIntlProvider } from "@/lib/i18n/ScopedIntlProvider";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <ScopedIntlProvider scope="onboarding">{children}</ScopedIntlProvider>;
}
