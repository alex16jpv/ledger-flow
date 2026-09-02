"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Banner } from "@/components/ui/Banner";
import { connectivityStore } from "@/lib/network/connectivity";

export function ConnectionBanner({ pendingChanges = 0 }: { pendingChanges?: number }) {
  const t = useTranslations("states");
  const phase = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot,
  );

  if (phase === "offline") {
    return (
      <Banner
        variant="offline"
        title={t("offline.title")}
        body={
          <>
            {t("offline.body")}
            {pendingChanges > 0 && ` ${t("offline.waiting", { count: pendingChanges })}`}
          </>
        }
      />
    );
  }
  if (phase === "back-online") {
    return (
      <Banner
        variant="online"
        title={t("backOnline.title")}
        body={pendingChanges > 0 ? t("backOnline.synced", { count: pendingChanges }) : undefined}
      />
    );
  }
  return null;
}
