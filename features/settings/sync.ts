"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { appEnvironment } from "@/lib/flags";
import { readStorageDurability, type StorageDurability } from "@/lib/local/persist";
import { vaultReady } from "@/lib/local/repository";
import { type DisplayMode, displayMode } from "@/lib/pwa/mode";
import { type ShellReadiness, shellReadiness } from "@/lib/pwa/readiness";
import { onShellWarmed } from "@/lib/pwa/service-worker";
import { SHELL_SCREENS } from "@/lib/pwa/shell";

export interface SyncSnapshot {
  // F-85: three of these rows are about the vault and the worker's cache, and neither is ready the
  // instant this screen mounts. Until this says otherwise the rows show a skeleton: telling a device
  // that synced yesterday that it never synced is worse than saying nothing for a moment.
  read: boolean;
  // Where the app registers a worker at all. Without one there are no screens to copy, so "Offline
  // ready" describes that instead of promising a wait that never ends.
  workerSupported: boolean;
  // The vault this screen is looking at, which is the one "Force full resync" rebuilds.
  userId: string | null;
  cursor: string | null;
  syncedAt: string | null;
  storage: StorageDurability | null;
  mode: DisplayMode;
  // The other half of "offline ready": the data is the vault, the screens are the worker's cache
  // (F-54).
  shell: ShellReadiness;
}

const EMPTY: SyncSnapshot = {
  read: false,
  workerSupported: false,
  userId: null,
  cursor: null,
  syncedAt: null,
  storage: null,
  mode: "browser",
  shell: { cached: 0, expected: SHELL_SCREENS },
};

// Support material, not a screen the user watches: it is read once when the screen opens and again
// after a resync, never on a timer (§4.2 has no periodic anything).
export function useSyncSnapshot(): { snapshot: SyncSnapshot; reload: () => void } {
  const locale = useLocale();
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(EMPTY);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const state = { cancelled: false };
    const load = () => {
      void (async () => {
        // F-85: `startMirror` opens the vault with a promise, so at mount the handle is still null.
        // This is the gate every read already waits on (F-31), not a guess about timing.
        const vault = await vaultReady();
        const [cursor, syncedAt, storage, shell] = await Promise.all([
          vault ? vault.db.get("meta", "syncCursor") : undefined,
          vault ? vault.db.get("meta", "syncedAt") : undefined,
          readStorageDurability(),
          shellReadiness(locale),
        ]);
        if (state.cancelled) return;
        setSnapshot({
          read: true,
          workerSupported: appEnvironment === "production" && "serviceWorker" in navigator,
          userId: vault?.userId ?? null,
          cursor: typeof cursor?.value === "string" ? cursor.value : null,
          syncedAt: typeof syncedAt?.value === "string" ? syncedAt.value : null,
          storage,
          mode: displayMode(),
          shell,
        });
      })();
    };
    load();
    // The warm finishes after the screen opened more often than not, and "Preparing…" that never
    // becomes "Ready" is what F-85 looked like from the outside.
    return () => {
      state.cancelled = true;
    };
  }, [locale, nonce]);

  useEffect(
    () =>
      onShellWarmed(() => {
        setNonce((value) => value + 1);
      }),
    [],
  );

  const reload = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  return { snapshot, reload };
}
