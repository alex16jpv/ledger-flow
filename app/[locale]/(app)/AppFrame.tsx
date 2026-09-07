"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { type ReactNode, Suspense, useCallback, useEffect, useState } from "react";

import {
  ADD_HREF,
  type AddOptions,
  AppShell,
  ConnectionBanner,
  SessionExpiredSheet,
} from "@/components/shell";
import { ToastProvider } from "@/components/ui/Toast";
import { usePendingCount } from "@/features/transactions/hooks";
import { readSessionMarker, vaultUserFor } from "@/lib/auth/marker";
import { LOGIN_PATH, REAUTH_PARAM } from "@/lib/auth/routes";
import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { isAppLocale } from "@/lib/i18n/routing";
import { noMirror, startMirror } from "@/lib/local/mirror";
import { expectVault } from "@/lib/local/repository";
import { useMirrorProfile } from "@/lib/local/useMirrorProfile";
import { HistoryTracker } from "@/lib/navigation/history";
import { startHeartbeat } from "@/lib/network/heartbeat";
import { warmAppShell } from "@/lib/pwa/service-worker";
import { invalidateMirrorBacked } from "@/lib/query/domains";
import { useMounted } from "@/lib/react/useMounted";
import { SessionProvider, useSession } from "@/lib/session";

import { QuickAddSheet } from "./QuickAddSheet";
import { ServiceWorkerUpdates } from "./ServiceWorkerUpdates";

function Frame({ children }: { children: ReactNode }) {
  // The screens below render, and query, before any effect here runs: the gate that makes a read
  // wait for the vault has to go up now, not where the vault is opened (F-31).
  expectVault();
  // The document the worker serves for this URL may have been rendered for another one — another
  // query, another row (D-28) — and React keeps the server's attributes when they do not match, so
  // a filter chip would stay on the server's choice. The screens are data-driven client work anyway:
  // they render once the client owns the page.
  const mounted = useMounted();
  const session = useSession();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const pendingCount = usePendingCount(session.status === "authenticated");
  const [quickAdd, setQuickAdd] = useState<AddOptions & { open: boolean }>({
    open: false,
    chain: false,
  });
  // Closing the sheet in local mode closes it for good (F-41); the `signedout` stripe is what stays
  // behind, and a session that comes back remounts this frame with the flag clear.
  const [sheetDismissed, setSheetDismissed] = useState(false);
  useEffect(() => startHeartbeat(), []);
  const userId = session.user?.id;
  const sessionStatus = session.status;
  // Read once per mount: the marker only changes on a sign-in or a sign-out, and both remount this.
  const [marker] = useState(() => readSessionMarker());
  const localUserId = vaultUserFor(
    userId,
    sessionStatus === "loading" ? "loading" : "resolved",
    marker,
  );
  // Who the user is when the session cannot say — an offline cold start, or local mode (§2.6): the
  // profile the pull stored, the same row `/api/auth/me` answers. Without it the currency and the
  // zone fell to the app's defaults and every figure shown offline wore the wrong symbol (F-63).
  // With a session, the session wins.
  const mirrorProfile = useMirrorProfile(Boolean(localUserId) && session.user === null);
  const user = session.user ?? mirrorProfile;
  // F-38: what the pull writes into the mirror only reaches the screens through an invalidation.
  const onMirrorChanged = useCallback(() => {
    void invalidateMirrorBacked(queryClient);
  }, [queryClient]);
  // §2.6: the session cannot be resolved — no network, or the refresh is dead — but the marker says
  // this device holds a vault for that user, so the app opens it and runs in local mode. Only the
  // user decides this: a session that settles later for the same user must not restart the mirror,
  // because every read in that gap would go to the server (R-3b).
  useEffect(() => {
    if (localUserId) return startMirror(localUserId, { onChanged: onMirrorChanged });
    return undefined;
  }, [localUserId, onMirrorChanged]);
  useEffect(() => {
    // Still asking who this is: the reads keep waiting. Anywhere else, no vault is coming.
    if (!localUserId && sessionStatus !== "loading") noMirror();
  }, [localUserId, sessionStatus]);
  // Warmed for whoever has a vault here, not only for a live session: local mode (§2.6) has to
  // survive a worker update too, and a dead session still has the marker the proxy lets through.
  useEffect(() => {
    if (!localUserId) return;
    void warmAppShell(locale);
  }, [localUserId, locale]);

  // `reauth` is what gets past the marker on the way to the login (§2.6); without it the proxy
  // would send a device with a 400-day marker straight back to the app it cannot sync.
  const goToLogin = useCallback(() => {
    router.replace(`${LOGIN_PATH}?${REAUTH_PARAM}=1&next=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  return (
    <FormatSettingsProvider currency={user?.currency} timeZone={user?.timezone}>
      <Suspense>
        <HistoryTracker />
      </Suspense>
      <ServiceWorkerUpdates />
      <AppShell
        userName={user?.name ?? ""}
        pendingCount={pendingCount}
        onAdd={({ chain }) => {
          setQuickAdd({ open: true, chain });
        }}
        banner={<ConnectionBanner signedOut={sessionStatus === "expired"} onSignIn={goToLogin} />}
      >
        {mounted ? children : null}
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
      <SessionExpiredSheet
        open={sessionStatus === "expired" && !sheetDismissed}
        localMode={localUserId !== undefined}
        onSignIn={goToLogin}
        onClose={() => {
          setSheetDismissed(true);
        }}
      />
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
