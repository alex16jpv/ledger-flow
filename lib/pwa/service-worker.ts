import { shellUrls, WARM_SHELL_MESSAGE, type WarmShellMessage } from "./shell";

export type UpdateListener = () => void;

// Registers /sw.js (emitted by Serwist in production builds) and reports when a newer worker is waiting.
export async function registerServiceWorker(onUpdate: UpdateListener): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
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
