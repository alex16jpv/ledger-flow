"use client";

import { useCallback, useEffect, useState } from "react";

import { readStorageDurability, type StorageDurability } from "@/lib/local/persist";
import { currentVault } from "@/lib/local/repository";
import { type DisplayMode, displayMode } from "@/lib/pwa/mode";

export interface SyncSnapshot {
  // The vault this screen is looking at, which is the one "Force full resync" rebuilds.
  userId: string | null;
  cursor: string | null;
  syncedAt: string | null;
  storage: StorageDurability | null;
  mode: DisplayMode;
}

const EMPTY: SyncSnapshot = {
  userId: null,
  cursor: null,
  syncedAt: null,
  storage: null,
  mode: "browser",
};

// Support material, not a screen the user watches: it is read once when the screen opens and again
// after a resync, never on a timer (§4.2 has no periodic anything).
export function useSyncSnapshot(): { snapshot: SyncSnapshot; reload: () => void } {
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(EMPTY);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const state = { cancelled: false };
    void (async () => {
      const vault = currentVault();
      const [cursor, syncedAt, storage] = await Promise.all([
        vault ? vault.db.get("meta", "syncCursor") : undefined,
        vault ? vault.db.get("meta", "syncedAt") : undefined,
        readStorageDurability(),
      ]);
      if (state.cancelled) return;
      setSnapshot({
        userId: vault?.userId ?? null,
        cursor: typeof cursor?.value === "string" ? cursor.value : null,
        syncedAt: typeof syncedAt?.value === "string" ? syncedAt.value : null,
        storage,
        mode: displayMode(),
      });
    })();
    return () => {
      state.cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  return { snapshot, reload };
}
