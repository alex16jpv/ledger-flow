"use client";

import type { ReactNode } from "react";

import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

// Only the authenticated app, the access flow and the dev screens need these: the public pages stay static.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <FormatSettingsProvider>{children}</FormatSettingsProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
