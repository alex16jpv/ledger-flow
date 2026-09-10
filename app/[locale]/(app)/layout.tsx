import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/AppProviders";
import { UNKNOWN_ROW_HEADER } from "@/lib/routing/entity-route";

import { AppFrame } from "./AppFrame";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Here and not in the page: `loading.tsx` wraps the children, so below this the status is already sent.
  if ((await headers()).get(UNKNOWN_ROW_HEADER) === "1") notFound();
  return (
    <AppProviders>
      <AppFrame>{children}</AppFrame>
    </AppProviders>
  );
}
