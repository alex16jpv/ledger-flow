"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

interface AppShellProps {
  userName: string;
  pendingCount: number;
  banner?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}

export const MAIN_ID = "main";

export function AppShell({
  userName,
  pendingCount,
  banner,
  narrow = false,
  children,
}: AppShellProps) {
  const t = useTranslations("common");
  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink"
      >
        {t("skipToContent")}
      </a>
      <Sidebar userName={userName} pendingCount={pendingCount} />
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="min-h-0 min-w-0 [scrollbar-width:thin] overflow-y-auto pb-6 md:pb-10"
      >
        {banner}
        <div
          className={cn(
            "mx-auto flex w-full min-w-0 flex-col gap-5 px-4 sm:px-6 md:gap-6 md:px-8",
            narrow ? "max-w-[640px]" : "max-w-(--content-max)",
          )}
        >
          {children}
        </div>
      </main>
      <TabBar pendingCount={pendingCount} />
    </div>
  );
}
