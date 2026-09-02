"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";

import {
  ADD_HREF,
  type AddOptions,
  AppShell,
  ConnectionBanner,
  SessionExpiredSheet,
} from "@/components/shell";
import { ToastProvider } from "@/components/ui/Toast";
import { usePendingCount } from "@/features/transactions/hooks";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { isAppLocale } from "@/lib/i18n/routing";
import { startHeartbeat } from "@/lib/network/heartbeat";
import { SessionProvider, useSession } from "@/lib/session";

import { QuickAddSheet } from "./QuickAddSheet";

function Frame({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const pendingCount = usePendingCount(session.status === "authenticated");
  const [quickAdd, setQuickAdd] = useState<AddOptions & { open: boolean }>({
    open: false,
    chain: false,
  });
  useEffect(() => startHeartbeat(), []);

  const goToLogin = useCallback(() => {
    router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  return (
    <FormatSettingsProvider currency={session.user?.currency} timeZone={session.user?.timezone}>
      <AppShell
        userName={session.user?.name ?? ""}
        pendingCount={pendingCount}
        onAdd={({ chain }) => {
          setQuickAdd({ open: true, chain });
        }}
        banner={<ConnectionBanner />}
      >
        {children}
      </AppShell>
      <QuickAddSheet
        open={quickAdd.open}
        chain={quickAdd.chain}
        onClose={() => {
          setQuickAdd((state) => ({ ...state, open: false }));
        }}
        onMoreDetails={(params) => {
          router.push({ pathname: ADD_HREF, query: Object.fromEntries(params) });
        }}
      />
      <SessionExpiredSheet open={session.status === "expired"} onSignIn={goToLogin} />
    </FormatSettingsProvider>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const onSignedOut = useCallback(() => {
    router.replace(LOGIN_PATH);
  }, [router]);
  const onLocaleChanged = useCallback(
    (locale: string) => {
      if (isAppLocale(locale)) router.replace(pathname, { locale });
    },
    [router, pathname],
  );

  return (
    <SessionProvider onSignedOut={onSignedOut} onLocaleChanged={onLocaleChanged}>
      <ToastProvider>
        <Frame>{children}</Frame>
      </ToastProvider>
    </SessionProvider>
  );
}
