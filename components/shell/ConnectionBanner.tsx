"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Banner } from "@/components/ui/Banner";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { connectivityStore } from "@/lib/network/connectivity";

export function ConnectionBanner() {
  const t = useTranslations("states");
  const outbox = useOutbox();
  const phase = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot,
  );

  // A conflict is the one thing the user has to act on, and it outlives coming back online. The
  // sheet that resolves it arrives with O-F5a; until then the banner says how many are waiting.
  if (outbox.conflicts > 0) {
    return (
      <Banner
        variant="error"
        title={t("conflicts.title")}
        body={t("conflicts.body", { count: outbox.conflicts })}
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
