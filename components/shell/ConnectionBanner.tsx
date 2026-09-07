"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Banner } from "@/components/ui/Banner";
import { useRouter } from "@/lib/i18n/navigation";
import { syncedStore } from "@/lib/local/outbox/synced";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { connectivityStore } from "@/lib/network/connectivity";

import { SyncConflictSheet } from "./SyncConflictSheet";

// F-72: with a network the queue drains in ~30 ms, so painting the stripe on `pending > 0` alone made
// every write flash it for a frame and push the content 55 px down and back up. Nothing is said until
// the queue has been waiting this long. Raise it if the flash comes back on a slow link; lower it to
// announce a real wait sooner.
export const PENDING_GRACE_MS = 1_000;

// The grace only ever delays the first word about a queue: a round that already failed says it at once,
// and losing the network paints the offline stripe, which does not go through here.
function useWaitedForIt(waiting: boolean, delayMs: number): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setWaited(true);
    }, delayMs);
    // The cleanup is what forgets a queue that drained: it runs when `waiting` turns false, so the
    // next write starts its own grace instead of inheriting the last one's.
    return () => {
      clearTimeout(timer);
      setWaited(false);
    };
  }, [waiting, delayMs]);
  return waited;
}

interface ConnectionBannerProps {
  // The session died with a vault on the device (§2.6): the app keeps working, but nothing it
  // records is reaching the server, and this is the only place that says so once the sheet is gone.
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
  const waitedForIt = useWaitedForIt(outbox.pending > 0, PENDING_GRACE_MS);

  // The order is DESIGN.md §8.12 and only one stripe is painted: with no network nothing can be
  // signed in or sent, so `offline` wins; with the queue blocked or the session dead, resolving
  // conflicts changes nothing yet, so both come before `error`.
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
  // An update this build cannot migrate past left these behind (F-65): nothing the user does sends
  // them, so it comes before the conflicts, which are still worth resolving.
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
  // Something the user has to act on outlives coming back online (F-23). "Review" opens the first
  // of them in queue order; "See all" goes to the tray that lists every one of them.
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
        <SyncConflictSheet
          open={reviewing !== null}
          seq={reviewing}
          onClose={() => {
            setReviewing(null);
          }}
        />
      </>
    );
  }
  // With network and a queue that did not drain, the amber stripe is the only thing telling the
  // user their figures are ahead of the server — but only once the queue has really stopped moving
  // (F-72): under the grace it is the round trip of the write the user just made, not a wait. A
  // queue whose last round failed has waited long enough already, whatever the clock says.
  if (outbox.pending > 0 && (waitedForIt || outbox.lastError !== null)) {
    return (
      <Banner
        variant="offline"
        title={t("pending.title")}
        body={`${t("pending.body")} ${t("offline.waiting", { count: outbox.pending })}`}
      />
    );
  }
  // The green stripe closes the circle the amber one opened: "2 changes waiting" becomes "2 changes
  // synced" (F-62). A round that drained nothing says only that the network is back — never
  // "0 changes synced".
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
