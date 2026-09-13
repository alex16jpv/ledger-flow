import { readSessionMarker } from "@/lib/auth/marker";
import { connectivityStore } from "@/lib/network/connectivity";
import { isLocalOnly } from "@/lib/network/local-only";
import { fetchCurrentUser } from "@/lib/session/api";

import { loadClockOffset } from "./clock";
import { isVaultSupported, openVault, VAULT, type VaultHandle } from "./db";
import { noteVaultOpened, reportVaultEvictionIfAny } from "./evicted";
import {
  refreshOutboxStatus,
  requestSync,
  resetOutboxStatus,
  setBlockedOperations,
  startSyncEngine,
} from "./outbox";
import { requestPersistentStorage } from "./persist";
import { pullChanges, type PullOptions } from "./pull";
import { purgeVault } from "./purge";
import { setCurrentVault } from "./repository";
import { PROFILE_KEY, profileRecord } from "./schema";

// Plan §4.2: on open, on focus if stale, and after a push — never on a background timer.
export const PULL_STALE_MS = 5 * 60_000;

export interface MirrorOptions {
  pull?: PullOptions;
  now?: () => number;
  // F-38: the pull writes behind React Query's back; nothing here knows about React.
  onChanged?: () => void;
}

// Nothing on this page is going to open a vault: the reads waiting for one (F-31) stop waiting.
export function noMirror(): void {
  setCurrentVault(null);
}

// The running mirror's own pull, so "Force full resync" can ask for one without a second engine.
let activePull: (() => Promise<void>) | null = null;
// A background pass swallows its failure; the resync threw the copy away first, so it needs it.
let lastPullError: Error | null = null;

function takeLastPullError(): Error | null {
  const failure = lastPullError;
  lastPullError = null;
  return failure;
}

export class ResyncUnavailableError extends Error {
  constructor(reason: string) {
    super(`The offline copy cannot be downloaded again: ${reason}`);
    this.name = "ResyncUnavailableError";
  }
}

async function runPull(pull: (() => Promise<void>) | null): Promise<void> {
  if (!pull) throw new ResyncUnavailableError("no mirror is open on this device");
  takeLastPullError();
  await pull();
  const failure = takeLastPullError();
  if (failure) throw failure;
}

// H-14: a copy that cannot answer yet is one pass away, and asking for it is not a resync.
export async function pullNow(): Promise<void> {
  if (isLocalOnly()) throw new ResyncUnavailableError("this device is working on its own");
  await runPull(activePull);
}

// Invariant 7: the queue is the only place unsent work exists, so a resync leaves it alone.
export async function forceFullResync(userId: string): Promise<void> {
  if (isLocalOnly()) throw new ResyncUnavailableError("this device is working on its own");
  const pull = activePull;
  await purgeVault(userId, { discardPendingWork: false });
  await runPull(pull);
}

export function startMirror(userId: string, options: MirrorOptions = {}): () => void {
  const now = options.now ?? Date.now;
  let handle: VaultHandle | null = null;
  let running: Promise<void> | null = null;
  let wanted = 0;
  let served = 0;
  let lastPullAt = 0;
  const state = { stopped: false };

  // H-14: the feed carries the profile only when it changed, so a mirror can end with no zone.
  const ensureProfile = async (vault: VaultHandle): Promise<boolean> => {
    if (await vault.db.get("profile", PROFILE_KEY)) return false;
    const { user } = await fetchCurrentUser();
    await vault.db.put("profile", profileRecord(user));
    return true;
  };

  const pullOnce = (vault: VaultHandle): Promise<void> => {
    served = wanted;
    return pullChanges(vault, options.pull)
      .then(async (result) => {
        lastPullAt = now();
        lastPullError = null;
        // A profile that cannot be fetched must not cost the screens what this pass did bring.
        let stored = false;
        try {
          stored = await ensureProfile(vault);
        } catch (error: unknown) {
          lastPullError = error instanceof Error ? error : new Error(String(error));
          console.warn("ledger-flow: the mirror could not fetch the profile it lacks", error);
        }
        if (result.changed || stored) options.onChanged?.();
      })
      .catch((error: unknown) => {
        // lib/api already reported it; the mirror keeps serving whatever the last pull left.
        lastPullError = error instanceof Error ? error : new Error(String(error));
        console.warn("ledger-flow: pulling the offline mirror failed", error);
      });
  };

  // F-32: a request arriving mid-pull joins the one in flight, so it asks for a pass of its own.
  const pull = (): Promise<void> => {
    const vault = handle;
    if (!vault || state.stopped) return Promise.resolve();
    // P-32: in this-device-only nothing goes out, and a pull is a request like any other.
    if (isLocalOnly()) return Promise.resolve();
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

  activePull = pull;
  const unsubscribe = connectivityStore.subscribe(onConnectivity);
  window.addEventListener("focus", pullIfStale);
  document.addEventListener("visibilitychange", pullIfStale);
  // The engine owns its own triggers; what it borrows from here is the pull that follows a round.
  const stopEngine = startSyncEngine({ afterRound: pull });

  // F-14: another tab's new schema closes this connection, so reads go back to the server.
  const reopen = (): void => {
    if (state.stopped) return;
    handle = null;
    setCurrentVault(null);
    void openVault(userId, VAULT, { onClosed: reopen })
      .then((reopened) => {
        if (state.stopped) {
          reopened.close();
          return;
        }
        handle = reopened;
        setCurrentVault(reopened);
        return refreshOutboxStatus(reopened.db).then(() => pull());
      })
      .catch((error: unknown) => {
        console.warn("ledger-flow: the offline mirror could not be reopened", error);
      });
  };

  const ready = (async () => {
    if (!isVaultSupported()) return;
    // D-20: before opening, because opening is what creates the vault the marker claims.
    const marker = readSessionMarker();
    if (marker?.userId === userId) {
      await reportVaultEvictionIfAny(userId, marker.issuedAt).catch(() => false);
    }
    const opened = await openVault(userId, VAULT, { onClosed: reopen });
    if (state.stopped) {
      opened.close();
      return;
    }
    handle = opened;
    noteVaultOpened(userId);
    setCurrentVault(opened);
    // F-65: the app keeps writing; all this does is make the operations left behind visible.
    setBlockedOperations(opened.blockedSeqs);
    // Invariant 7: the queue survives reloads, so the banner knows before the first write.
    await refreshOutboxStatus(opened.db);
    // What the last session learned about this device's clock, before the first form opens (F-66).
    await loadClockOffset(opened.db);
    // O-F1: from this item on the vault holds data, and without the grant it can be evicted.
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
    activePull = null;
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
