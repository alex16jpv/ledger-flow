import { connectivityStore } from "@/lib/network/connectivity";

import { isVaultSupported, openVault, type VaultHandle } from "./db";
import { refreshOutboxStatus, requestSync, resetOutboxStatus, startSyncEngine } from "./outbox";
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

// Nothing on this page is going to open a vault: the reads waiting for one (F-31) stop waiting.
export function noMirror(): void {
  setCurrentVault(null);
}

export function startMirror(userId: string, options: MirrorOptions = {}): () => void {
  const now = options.now ?? Date.now;
  let handle: VaultHandle | null = null;
  let running: Promise<void> | null = null;
  let wanted = 0;
  let served = 0;
  let lastPullAt = 0;
  const state = { stopped: false };

  const pullOnce = (vault: VaultHandle): Promise<void> => {
    served = wanted;
    return pullChanges(vault, options.pull)
      .then(() => {
        lastPullAt = now();
      })
      .catch((error: unknown) => {
        // lib/api already reported it; the mirror keeps serving whatever the last pull left.
        console.warn("ledger-flow: pulling the offline mirror failed", error);
      });
  };

  // The engine's discipline (F-32): a request that arrives mid-pull joins the one in flight, which
  // cannot carry what the server wrote after it started, so it asks for a pass of its own after.
  const pull = (): Promise<void> => {
    const vault = handle;
    if (!vault || state.stopped) return Promise.resolve();
    wanted += 1;
    const mine = wanted;
    running ??= pullOnce(vault).finally(() => {
      running = null;
    });
    return running.then(() => (mine > served ? pull() : undefined));
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
  // The engine owns its own triggers; what it borrows from here is the pull that follows a round.
  const stopEngine = startSyncEngine({ afterRound: pull });

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
    // Opening the app is a trigger too: whatever the queue kept from the last session goes out now.
    await requestSync();
  })();

  ready
    .catch((error: unknown) => {
      console.warn("ledger-flow: the offline mirror could not be opened", error);
    })
    .finally(() => {
      // A read waiting for this vault (F-31) gets its answer even when none opened.
      if (!state.stopped) setCurrentVault(handle);
    });

  return () => {
    state.stopped = true;
    unsubscribe();
    stopEngine();
    window.removeEventListener("focus", pullIfStale);
    document.removeEventListener("visibilitychange", pullIfStale);
    setCurrentVault(null);
    resetOutboxStatus();
    handle?.close();
    handle = null;
  };
}
