import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/AppProviders";
import { AuthFrame } from "@/components/shell/AuthFrame";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AuthFrame>{children}</AuthFrame>
    </AppProviders>
  );
}
