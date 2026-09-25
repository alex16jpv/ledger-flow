import {
  SHELL_WARMED_MESSAGE,
  shellUrls,
  WARM_SHELL_MESSAGE,
  type WarmShellMessage,
} from "./shell";

// §6 O-F6: a route the user never opened still answers with no network.
export async function warmAppShell(locale: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const message: WarmShellMessage = {
    type: WARM_SHELL_MESSAGE,
    urls: shellUrls(locale, window.location.origin),
  };
  registration.active?.postMessage(message);
}

// F-54: without it the page would have to poll to know whether the device is ready.
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
