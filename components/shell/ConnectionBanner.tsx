"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { Banner } from "@/components/ui/Banner";
import { useRouter } from "@/lib/i18n/navigation";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { connectivityStore } from "@/lib/network/connectivity";

import { SyncConflictSheet } from "./SyncConflictSheet";

export function ConnectionBanner() {
  const t = useTranslations("states");
  const outbox = useOutbox();
  const router = useRouter();
  const [reviewing, setReviewing] = useState<number | null>(null);
  const phase = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot,
  );

  // Something the user has to act on outlives coming back online, so it is checked before the
  // network: a conflict, and a refusal the queue could not undo (F-23). "Review" opens the first of
  // them in queue order; "See all" goes to the tray that lists every one of them.
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
  // "n changes synced" needs an engine that knows what it flushed, which is O-F4 part 2; until then
  // the green stripe says only that the network is back.
  if (phase === "back-online") return <Banner variant="online" title={t("backOnline.title")} />;
  // With network and a queue that did not drain, the amber stripe is the only thing telling the
  // user their figures are ahead of the server.
  if (outbox.pending > 0) {
    return (
      <Banner
        variant="offline"
        title={t("pending.title")}
        body={`${t("pending.body")} ${t("offline.waiting", { count: outbox.pending })}`}
      />
    );
  }
  return null;
}
