import { connectivityStore } from "@/lib/network/connectivity";

import { isVaultSupported, openVault, type VaultHandle } from "./db";
import { refreshOutboxStatus, resetOutboxStatus } from "./outbox";
import { requestPersistentStorage } from "./persist";
import { pullChanges, type PullOptions } from "./pull";
import { setCurrentVault } from "./repository";

// Plan §4.2: pull on open, on regaining focus if the copy is stale, and after a push. Never on a
// background timer, which is the traffic pattern local-first exists to remove.
export const PULL_STALE_MS = 5 * 60_000;

export interface MirrorOptions {
  pull?: PullOptions;
  now?: () => number;
}

export function startMirror(userId: string, options: MirrorOptions = {}): () => void {
  const now = options.now ?? Date.now;
  let handle: VaultHandle | null = null;
  let running: Promise<void> | null = null;
  let lastPullAt = 0;
  const state = { stopped: false };

  const pull = (): Promise<void> => {
    const vault = handle;
    if (!vault || state.stopped) return Promise.resolve();
    running ??= pullChanges(vault, options.pull)
      .then(() => {
        lastPullAt = now();
      })
      .catch((error: unknown) => {
        // lib/api already reported it; the mirror keeps serving whatever the last pull left.
        console.warn("ledger-flow: pulling the offline mirror failed", error);
      })
      .finally(() => {
        running = null;
      });
    return running;
  };

  const pullIfStale = (): void => {
    if (document.visibilityState !== "visible") return;
    if (now() - lastPullAt >= PULL_STALE_MS) void pull();
  };

  const onConnectivity = (): void => {
    if (connectivityStore.getSnapshot() === "back-online") void pull();
  };

  const unsubscribe = connectivityStore.subscribe(onConnectivity);
  window.addEventListener("focus", pullIfStale);
  document.addEventListener("visibilitychange", pullIfStale);

  const ready = (async () => {
    if (!isVaultSupported()) return;
    const opened = await openVault(userId);
    if (state.stopped) {
      opened.close();
      return;
    }
    handle = opened;
    setCurrentVault(opened);
    // The queue survives reloads, so the banner and the marked figures have to know about it before
    // the first write of the session (invariant 7).
    await refreshOutboxStatus(opened.db);
    // Written in O-F1 and called here for the first time: from this item on the vault holds data,
    // and without the grant the browser may evict it under storage pressure.
    await requestPersistentStorage();
    await pull();
  })();

  ready.catch((error: unknown) => {
    console.warn("ledger-flow: the offline mirror could not be opened", error);
  });

  return () => {
    state.stopped = true;
    unsubscribe();
    window.removeEventListener("focus", pullIfStale);
    document.removeEventListener("visibilitychange", pullIfStale);
    setCurrentVault(null);
    resetOutboxStatus();
    handle?.close();
    handle = null;
  };
}
