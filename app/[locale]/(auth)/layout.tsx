import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/AppProviders";
import { AuthFrame } from "@/components/shell/AuthFrame";
import { ScopedIntlProvider } from "@/lib/i18n/ScopedIntlProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ScopedIntlProvider scope="auth">
      <AppProviders>
        <AuthFrame>{children}</AuthFrame>
      </AppProviders>
    </ScopedIntlProvider>
  );
}
