import { env } from "@/lib/env";

import {
  SHELL_WARMED_MESSAGE,
  shellUrls,
  WARM_SHELL_MESSAGE,
  type WarmShellMessage,
} from "./shell";

export type UpdateListener = () => void;

// Registers the worker Serwist emitted for this build (`/sw.js`, or the e2e one — F-56) and reports
// when a newer worker is waiting.
export async function registerServiceWorker(onUpdate: UpdateListener): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.register(env.NEXT_PUBLIC_SW_PATH, {
    scope: "/",
  });
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdate();
    });
  };
  watch(registration.installing);
  registration.addEventListener("updatefound", () => {
    watch(registration.installing);
  });
}

export async function activateWaitingWorker(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      window.location.reload();
    },
    { once: true },
  );
}

// Asks the worker for the shell of every (app) route, so one the user never opened still answers
// with no network (§6 O-F6). It only ever resolves where a worker is registered.
export async function warmAppShell(locale: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const message: WarmShellMessage = {
    type: WARM_SHELL_MESSAGE,
    urls: shellUrls(locale, window.location.origin),
  };
  registration.active?.postMessage(message);
}

// When the worker says it has been through the list. Without it the page would have to poll to find
// out whether this device is ready to run with no network (F-54).
export function onShellWarmed(listener: () => void): () => void {
  if (!("serviceWorker" in navigator)) return () => undefined;
  const handler = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === SHELL_WARMED_MESSAGE) listener();
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => {
    navigator.serviceWorker.removeEventListener("message", handler);
  };
}
