"use client";

import { useEffect } from "react";

import { appEnvironment } from "@/lib/flags";
import { reportUpdateWaiting, resurfaceUpdate } from "@/lib/pwa/update";

export function ServiceWorkerUpdates() {
  useEffect(() => {
    // The e2e build is a production build flagged as "test": it must not install the worker.
    if (appEnvironment !== "production") return;
    let active = true;
    let stop: (() => void) | undefined;
    void import("@/lib/pwa/registration").then(async (module) => {
      const registration = await module.registerServiceWorker(reportUpdateWaiting);
      if (!active || !registration) return;
      stop = module.checkForUpdatesOnReturn(registration, resurfaceUpdate);
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
  return null;
}
