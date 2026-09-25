import { env } from "@/lib/env";
import { reportError } from "@/lib/observability/reporter";

export type UpdateListener = () => void;

export const UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;

// F-56: the worker Serwist emitted for this build — `/sw.js`, or the e2e one.
export async function registerServiceWorker(
  onUpdate: UpdateListener,
): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register(env.NEXT_PUBLIC_SW_PATH, {
    scope: "/",
  });
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdate();
    });
  };
  if (registration.waiting && navigator.serviceWorker.controller) onUpdate();
  watch(registration.installing);
  registration.addEventListener("updatefound", () => {
    watch(registration.installing);
  });
  return registration;
}

export function checkForUpdatesOnReturn(
  registration: ServiceWorkerRegistration,
  onReturn: () => void,
): () => void {
  let lastCheck = Date.now();
  const handler = () => {
    if (document.visibilityState !== "visible") return;
    onReturn();
    if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastCheck = Date.now();
    registration.update().catch((error: unknown) => {
      if (navigator.onLine) reportError(error, "worker");
    });
  };
  document.addEventListener("visibilitychange", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
  };
}

export async function activateWaitingWorker(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      window.location.reload();
    },
    { once: true },
  );
  waiting.postMessage({ type: "SKIP_WAITING" });
}
