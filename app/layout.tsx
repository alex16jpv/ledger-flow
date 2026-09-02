import "./globals.css";

import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { geistMono, geistSans } from "@/app/fonts";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Ledger Flow",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
