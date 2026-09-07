"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { useToast } from "@/components/ui/Toast";
import { appEnvironment } from "@/lib/flags";
import { activateWaitingWorker, registerServiceWorker } from "@/lib/pwa/service-worker";

export function ServiceWorkerUpdates() {
  const t = useTranslations("pwa");
  const toast = useToast();
  useEffect(() => {
    // The e2e build is a production build flagged as "test": it must not install the worker.
    if (appEnvironment !== "production") return;
    void registerServiceWorker(() => {
      toast.show({
        message: t("updateAvailable"),
        action: {
          label: t("reload"),
          onClick: () => {
            void activateWaitingWorker();
          },
        },
      });
    });
  }, [t, toast]);
  return null;
}
