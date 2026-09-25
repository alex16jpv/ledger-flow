"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Banner } from "@/components/ui/Banner";
import { useRouter } from "@/lib/i18n/navigation";
import { syncedStore } from "@/lib/local/outbox/synced";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { connectivityStore } from "@/lib/network/connectivity";
import { localOnlyStore } from "@/lib/network/local-only";
import { applyUpdate, dismissUpdate, updateStore } from "@/lib/pwa/update";

import { MAIN_ID } from "./AppShell";

const SyncConflictSheet = dynamic(() =>
  import("./SyncConflictSheet").then((module) => module.SyncConflictSheet),
);

// F-72: raise it if the flash comes back on a slow link; lower it to announce a real wait sooner.
export const PENDING_GRACE_MS = 1_000;

// The grace only delays the first word: a failed round says it at once, and offline is elsewhere.
function useWaitedForIt(waiting: boolean, delayMs: number): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setWaited(true);
    }, delayMs);
    // The cleanup forgets a drained queue, so the next write starts its own grace.
    return () => {
      clearTimeout(timer);
      setWaited(false);
    };
  }, [waiting, delayMs]);
  return waited;
}

interface ConnectionBannerProps {
  // §2.6: the session died with a vault here, so nothing recorded is reaching the server.
  signedOut?: boolean;
  onSignIn?: () => void;
}

export function ConnectionBanner({ signedOut = false, onSignIn }: ConnectionBannerProps) {
  const t = useTranslations("states");
  const outbox = useOutbox();
  const router = useRouter();
  const [reviewing, setReviewing] = useState<number | null>(null);
  const phase = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot,
  );
  const synced = useSyncExternalStore(
    syncedStore.subscribe,
    syncedStore.getSnapshot,
    syncedStore.getServerSnapshot,
  );
  const localOnly = useSyncExternalStore(
    localOnlyStore.subscribe,
    localOnlyStore.getSnapshot,
    localOnlyStore.getServerSnapshot,
  );
  const update = useSyncExternalStore(
    updateStore.subscribe,
    updateStore.getSnapshot,
    updateStore.getServerSnapshot,
  );
  const waitedForIt = useWaitedForIt(outbox.pending > 0, PENDING_GRACE_MS);

  const updateStripe = (
    <Banner
      variant="update"
      title={t("update.title")}
      body={t("update.body")}
      action={{ label: t("update.reload"), onClick: applyUpdate }}
      dismiss={{
        label: t("update.dismiss"),
        onClick: () => {
          dismissUpdate();
          document.getElementById(MAIN_ID)?.focus();
        },
      }}
    />
  );

  // DESIGN §8.12 orders the stripes and only one is painted; P-32 says `localOnly` is a choice.
  if (localOnly) {
    // T-196: this mode lasts until the user leaves it, so behind it the notice would never show.
    if (update === "shown") return updateStripe;
    return (
      <Banner
        variant="offline"
        title={t("localOnly.title")}
        body={t("localOnly.body", { count: outbox.pending + outbox.attention })}
        action={onSignIn ? { label: t("localOnly.action"), onClick: onSignIn } : undefined}
      />
    );
  }
  if (phase === "offline") {
    return (
      <Banner
        variant="offline"
        title={t("offline.title")}
        body={
          <>
            {t("offline.body")}
            {outbox.pending > 0 && ` ${t("offline.waiting", { count: outbox.pending })}`}
          </>
        }
      />
    );
  }
  // F-65: nothing the user does sends these, so they come before conflicts, which are worth it.
  if (outbox.blocked.length > 0) {
    return (
      <Banner
        variant="blocked"
        title={t("blocked.title", { count: outbox.blocked.length })}
        body={t("blocked.body")}
        action={{
          label: t("blocked.cta"),
          onClick: () => {
            router.push("/sync");
          },
        }}
      />
    );
  }
  if (signedOut) {
    return (
      <Banner
        variant="signedout"
        title={t("signedOut.title")}
        body={outbox.pending > 0 ? t("signedOut.body", { count: outbox.pending }) : undefined}
        action={onSignIn ? { label: t("signedOut.cta"), onClick: onSignIn } : undefined}
      />
    );
  }
  // F-23: what the user must act on outlives coming back online.
  if (outbox.attention > 0) {
    return (
      <>
        <Banner
          variant="error"
          title={t("conflicts.title")}
          body={t("conflicts.body", { count: outbox.attention })}
          action={[
            {
              label: t("conflicts.review"),
              onClick: () => {
                setReviewing(outbox.firstAttention);
              },
            },
            {
              label: t("conflicts.seeAll"),
              onClick: () => {
                router.push("/sync");
              },
            },
          ]}
        />
        {reviewing !== null && (
          <SyncConflictSheet
            open
            seq={reviewing}
            onClose={() => {
              setReviewing(null);
            }}
          />
        )}
      </>
    );
  }
  if (update === "shown") return updateStripe;
  // F-72: under the grace this is the round trip of the write just made, not a wait.
  if (outbox.pending > 0 && (waitedForIt || outbox.lastError !== null)) {
    return (
      <Banner
        variant="offline"
        title={t("pending.title")}
        body={`${t("pending.body")} ${t("offline.waiting", { count: outbox.pending })}`}
      />
    );
  }
  // F-62: a round that drained nothing says only that the network is back, never 0 changes synced.
  if (phase === "back-online") {
    return (
      <Banner
        variant="online"
        title={t("backOnline.title")}
        body={synced > 0 ? t("backOnline.synced", { count: synced }) : undefined}
      />
    );
  }
  return null;
}
