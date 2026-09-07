import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/AppProviders";

import { AppFrame } from "./AppFrame";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppFrame>{children}</AppFrame>
    </AppProviders>
  );
}
