"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { type ReactNode, Suspense, useCallback, useEffect, useState } from "react";

import {
  ADD_HREF,
  type AddOptions,
  AppShell,
  ConnectionBanner,
  MoreSheet,
  NoSessionChoiceSheet,
  OfflineReadyAnnouncement,
  SessionExpiredSheet,
} from "@/components/shell";
import { ToastProvider } from "@/components/ui/Toast";
import { useAccountCount, useCategorySummary } from "@/features/settings/hooks";
import { useSharedSection, useWaitingInvitationCount } from "@/features/shared/hooks";
import { usePendingCount } from "@/features/transactions/hooks";
import { readSessionMarker, vaultUserFor } from "@/lib/auth/marker";
import { LOGIN_PATH, REAUTH_PARAM } from "@/lib/auth/routes";
import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import { localePrefix } from "@/lib/i18n/locales";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { isAppLocale } from "@/lib/i18n/routing";
import { noMirror, startMirror } from "@/lib/local/mirror";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { expectVault } from "@/lib/local/repository";
import { useMirrorProfile } from "@/lib/local/useMirrorProfile";
import { wipeThisDevice } from "@/lib/local/wipe";
import { HistoryTracker } from "@/lib/navigation/history";
import { reportOnline } from "@/lib/network/connectivity";
import { startHeartbeat } from "@/lib/network/heartbeat";
import { setLocalOnly } from "@/lib/network/local-only";
import { warmAppShell } from "@/lib/pwa/service-worker";
import { invalidateMirrorBacked } from "@/lib/query/domains";
import { useMounted } from "@/lib/react/useMounted";
import { SessionProvider, useSession } from "@/lib/session";
import { profileResolved } from "@/lib/session/profile";

import { ServiceWorkerUpdates } from "./ServiceWorkerUpdates";

const QuickAddSheet = dynamic(() =>
  import("./QuickAddSheet").then((module) => module.QuickAddSheet),
);

function Frame({ children }: { children: ReactNode }) {
  // F-31: the gate that makes a read wait for the vault must go up before the screens query.
  expectVault();
  // D-28: the worker may serve a document rendered for another URL, so screens render client-side.
  const mounted = useMounted();
  const session = useSession();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const pendingCount = usePendingCount();
  const outbox = useOutbox();
  const [quickAdd, setQuickAdd] = useState<AddOptions & { open: boolean }>({
    open: false,
    chain: false,
  });
  const [moreOpen, setMoreOpen] = useState(false);
  // F-41: closing the sheet in local mode closes it for good; a new session remounts it clear.
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
  // F-63: offline or in local mode (§2.6), the mirror profile carries the currency and the zone.
  const mirrorProfile = useMirrorProfile(Boolean(localUserId) && session.user === null);
  const user = session.user ?? mirrorProfile.user;
  const resolved = profileResolved({
    user,
    sessionStatus,
    mirrorPending: mirrorProfile.pending,
  });
  const accountCount = useAccountCount(moreOpen);
  const categorySummary = useCategorySummary(moreOpen);
  const shared = useSharedSection(moreOpen);
  const invitations = useWaitingInvitationCount();
  // F-38: what the pull writes into the mirror only reaches the screens through an invalidation.
  const onMirrorChanged = useCallback(() => {
    void invalidateMirrorBacked(queryClient);
  }, [queryClient]);
  // §2.6: only the user restarts the mirror — a later session for the same user must not (R-3b).
  useEffect(() => {
    if (localUserId) return startMirror(localUserId, { onChanged: onMirrorChanged });
    return undefined;
  }, [localUserId, onMirrorChanged]);
  useEffect(() => {
    // Still asking who this is: the reads keep waiting. Anywhere else, no vault is coming.
    if (!localUserId && sessionStatus !== "loading") noMirror();
  }, [localUserId, sessionStatus]);
  // Warmed for whoever has a vault here, not only a live session: local mode (§2.6) needs it too.
  useEffect(() => {
    if (!localUserId) return;
    void warmAppShell(locale);
  }, [localUserId, locale]);

  // `reauth` is what gets a device with a live marker past the proxy to the login (§2.6).
  const goToLogin = useCallback(() => {
    router.replace(`${LOGIN_PATH}?${REAUTH_PARAM}=1&next=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  return (
    <FormatSettingsProvider
      currency={user?.currency}
      timeZone={user?.timezone}
      profileResolved={resolved}
    >
      <Suspense>
        <HistoryTracker />
      </Suspense>
      <ServiceWorkerUpdates />
      <OfflineReadyAnnouncement enabled={Boolean(localUserId)} />
      <AppShell
        userName={user?.name ?? ""}
        pendingCount={pendingCount}
        invitations={invitations}
        moreOpen={moreOpen}
        onAdd={({ chain }) => {
          setQuickAdd({ open: true, chain });
        }}
        onMore={() => {
          setMoreOpen(true);
        }}
        banner={<ConnectionBanner signedOut={sessionStatus === "expired"} onSignIn={goToLogin} />}
      >
        {mounted ? children : null}
      </AppShell>
      <MoreSheet
        open={moreOpen}
        onClose={() => {
          setMoreOpen(false);
        }}
        userName={user?.name ?? ""}
        userEmail={user?.email ?? ""}
        accountCount={accountCount.data}
        categoryCounts={categorySummary.data}
        owedToYou={shared.section?.owedToYou}
        invitations={invitations}
      />
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
      {/* P-32: with a copy here the sheet has three exits (§8.17); without one, §8.12's wall. */}
      {localUserId === undefined ? (
        <SessionExpiredSheet open={sessionStatus === "expired"} onSignIn={goToLogin} />
      ) : (
        <NoSessionChoiceSheet
          open={sessionStatus === "expired" && !sheetDismissed}
          pending={outbox.pending + outbox.attention}
          onSignIn={goToLogin}
          onStayLocal={() => {
            setLocalOnly(true);
            reportOnline(false);
            setSheetDismissed(true);
          }}
          onWipe={async () => {
            await wipeThisDevice();
            setLocalOnly(false);
            queryClient.clear();
            // A full load, not a client navigation: after a wipe nothing in memory may survive.
            window.location.assign(
              new URL(`${localePrefix(locale)}${LOGIN_PATH}?wiped=1`, window.location.origin),
            );
          }}
        />
      )}
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
