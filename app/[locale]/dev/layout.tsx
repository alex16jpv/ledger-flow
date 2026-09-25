import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/AppProviders";
import { ScopedIntlProvider } from "@/lib/i18n/ScopedIntlProvider";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <ScopedIntlProvider scope="dev">
      <AppProviders>{children}</AppProviders>
    </ScopedIntlProvider>
  );
}
