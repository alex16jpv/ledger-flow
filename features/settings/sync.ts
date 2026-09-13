"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { appEnvironment } from "@/lib/flags";
import { readStorageDurability, type StorageDurability } from "@/lib/local/persist";
import { vaultCanAnswer, vaultReady } from "@/lib/local/repository";
import { type DisplayMode, displayMode } from "@/lib/pwa/mode";
import { type ShellReadiness, shellReadiness } from "@/lib/pwa/readiness";
import { onShellWarmed } from "@/lib/pwa/service-worker";
import { SHELL_SCREENS } from "@/lib/pwa/shell";

export interface SyncSnapshot {
  // F-85: until this says otherwise the rows show a skeleton rather than a wrong answer.
  read: boolean;
  // Without a worker there are no screens to copy, so Offline ready describes that instead.
  workerSupported: boolean;
  // The vault this screen is looking at, which is the one "Force full resync" rebuilds.
  userId: string | null;
  cursor: string | null;
  syncedAt: string | null;
  // H-14: `syncedAt` alone is a copy that may still decline every read with a date window.
  mirrorAnswers: boolean;
  storage: StorageDurability | null;
  mode: DisplayMode;
  // F-54: the other half of offline ready — the screens the worker cached.
  shell: ShellReadiness;
}

const EMPTY: SyncSnapshot = {
  read: false,
  workerSupported: false,
  userId: null,
  cursor: null,
  syncedAt: null,
  mirrorAnswers: false,
  storage: null,
  mode: "browser",
  shell: { cached: 0, expected: SHELL_SCREENS },
};

// Read when the screen opens and after a resync, never on a timer (§4.2 has none).
export function useSyncSnapshot(): { snapshot: SyncSnapshot; reload: () => void } {
  const locale = useLocale();
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(EMPTY);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const state = { cancelled: false };
    const load = () => {
      void (async () => {
        // F-31: `startMirror` opens the vault with a promise, so at mount the handle is still null.
        const vault = await vaultReady();
        const [cursor, syncedAt, mirrorAnswers, storage, shell] = await Promise.all([
          vault ? vault.db.get("meta", "syncCursor") : undefined,
          vault ? vault.db.get("meta", "syncedAt") : undefined,
          vault ? vaultCanAnswer(vault) : false,
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
          mirrorAnswers,
          storage,
          mode: displayMode(),
          shell,
        });
      })();
    };
    load();
    // F-85 was a Preparing… that never became Ready because the warm finishes after the mount.
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
