"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";

import { useToast } from "@/components/ui/Toast";
import { useRouter } from "@/lib/i18n/navigation";
import { currentVault } from "@/lib/local/repository";
import {
  markOfflineReadyAnnounced,
  offlineReadyAnnounced,
  shellReadiness,
} from "@/lib/pwa/readiness";
import { onShellWarmed } from "@/lib/pwa/service-worker";

const SYNC_STATUS_PATH = "/settings/sync";

// F-54: said once, on the device it is true of; Sync status is where it is looked up after.
export function OfflineReadyAnnouncement({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings.sync.offlineReadyToast");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!enabled || offlineReadyAnnounced()) return;
    const state = { cancelled: false };
    const check = () => {
      void (async () => {
        const shell = await shellReadiness(locale);
        if (shell.cached < shell.expected) return;
        const syncedAt = await currentVault()?.db.get("meta", "syncedAt");
        if (typeof syncedAt?.value !== "string") return;
        // Checked once, here: the only thing that must not happen after the unmount is the toast.
        if (state.cancelled || offlineReadyAnnounced()) return;
        markOfflineReadyAnnounced();
        toast.show({
          message: t("title"),
          action: {
            label: t("action"),
            onClick: () => {
              router.push(SYNC_STATUS_PATH);
            },
          },
        });
      })();
    };
    // The two halves finish in either order, so both the worker's answer and the mount are checked.
    const stop = onShellWarmed(check);
    check();
    return () => {
      state.cancelled = true;
      stop();
    };
  }, [enabled, locale, router, t, toast]);

  return null;
}
