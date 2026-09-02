"use client";

import { type ReactNode, useCallback } from "react";

import { AppShell, ConnectionBanner, SessionExpiredSheet } from "@/components/shell";
import { ToastProvider } from "@/components/ui/Toast";
import { usePendingCount } from "@/features/transactions/hooks";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { isAppLocale } from "@/lib/i18n/routing";
import { SessionProvider, useSession } from "@/lib/session";

function Frame({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const pendingCount = usePendingCount(session.status === "authenticated");

  const goToLogin = useCallback(() => {
    router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  return (
    <>
      <AppShell
        userName={session.user?.name ?? ""}
        pendingCount={pendingCount}
        banner={<ConnectionBanner />}
      >
        {children}
      </AppShell>
      <SessionExpiredSheet open={session.status === "expired"} onSignIn={goToLogin} />
    </>
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
