"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { readStorageDurability, type StorageDurability } from "@/lib/local/persist";
import { currentVault } from "@/lib/local/repository";
import { type DisplayMode, displayMode } from "@/lib/pwa/mode";
import { type ShellReadiness, shellReadiness } from "@/lib/pwa/readiness";
import { SHELL_SCREENS } from "@/lib/pwa/shell";

export interface SyncSnapshot {
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
    void (async () => {
      const vault = currentVault();
      const [cursor, syncedAt, storage, shell] = await Promise.all([
        vault ? vault.db.get("meta", "syncCursor") : undefined,
        vault ? vault.db.get("meta", "syncedAt") : undefined,
        readStorageDurability(),
        shellReadiness(locale),
      ]);
      if (state.cancelled) return;
      setSnapshot({
        userId: vault?.userId ?? null,
        cursor: typeof cursor?.value === "string" ? cursor.value : null,
        syncedAt: typeof syncedAt?.value === "string" ? syncedAt.value : null,
        storage,
        mode: displayMode(),
        shell,
      });
    })();
    return () => {
      state.cancelled = true;
    };
  }, [locale, nonce]);

  const reload = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  return { snapshot, reload };
}
