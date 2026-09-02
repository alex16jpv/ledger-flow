import { onlineManager } from "@tanstack/react-query";

import { checkHealth } from "@/lib/api/health";

import { connectivityStore, onNetworkFailure, reportOnline } from "./connectivity";

export const HEARTBEAT_INTERVAL_MS = 30_000;

let pinging: Promise<boolean> | null = null;

export function ping(check: () => Promise<boolean> = checkHealth): Promise<boolean> {
  pinging ??= check()
    .then((ok) => {
      reportOnline(ok);
      return ok;
    })
    .finally(() => {
      pinging = null;
    });
  return pinging;
}

// React Query pauses fetches while offline; the store, not navigator.onLine, is what says so (HANDOFF §3.19).
export function startHeartbeat(check: () => Promise<boolean> = checkHealth): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const sync = () => {
    const offline = connectivityStore.getSnapshot() === "offline";
    onlineManager.setOnline(!offline);
    if (offline && !timer) {
      timer = setInterval(() => {
        void ping(check);
      }, HEARTBEAT_INTERVAL_MS);
    } else if (!offline && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  const onFocus = () => {
    if (connectivityStore.getSnapshot() === "offline") void ping(check);
  };
  const unsubscribeStore = connectivityStore.subscribe(sync);
  const unsubscribeFailures = onNetworkFailure(() => {
    void ping(check);
  });
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);
  sync();
  return () => {
    unsubscribeStore();
    unsubscribeFailures();
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
    if (timer) clearInterval(timer);
    onlineManager.setOnline(true);
  };
}
