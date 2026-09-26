import { openDB } from "idb";

import { forgetOfflineReadyAnnouncement } from "@/lib/pwa/readiness";

import { isVaultSupported, otherVaultUsers, vaultExists } from "./db";
import { advanceMirrorEpoch, MIRROR_STORES, vaultDatabaseName, type VaultSchema } from "./schema";
import { markSuggestionsStale } from "./suggest/stale";

type VaultStore = (typeof MIRROR_STORES)[number] | "meta" | "outbox";

const PURGEABLE_STORES: readonly VaultStore[] = [...MIRROR_STORES, "meta", "outbox"];

export interface VaultPurgeOptions {
  discardPendingWork?: boolean;
}

export interface VaultPurgeOutcome {
  mirrorCleared: boolean;
  operationsDiscarded: number;
  operationsKept: number;
}

const NOTHING: VaultPurgeOutcome = {
  mirrorCleared: false,
  operationsDiscarded: 0,
  operationsKept: 0,
};

async function clearVault(userId: string, options: VaultPurgeOptions): Promise<VaultPurgeOutcome> {
  const db = await openDB<VaultSchema>(vaultDatabaseName(userId));
  try {
    const names = PURGEABLE_STORES.filter((name) => db.objectStoreNames.contains(name));
    if (names.length === 0) return NOTHING;

    const pending = names.includes("outbox") ? await db.count("outbox") : 0;
    const discard = options.discardPendingWork === true || pending === 0;

    const tx = db.transaction(names, "readwrite");
    for (const name of MIRROR_STORES) {
      if (names.includes(name)) await tx.objectStore(name).clear();
    }
    if (names.includes("meta")) {
      const meta = tx.objectStore("meta");
      await meta.delete("syncCursor");
      await meta.delete("syncedAt");
      await advanceMirrorEpoch(meta);
      if (discard) await meta.delete("outboxSeq");
    }
    if (discard && names.includes("outbox")) await tx.objectStore("outbox").clear();
    await tx.done;

    markSuggestionsStale();
    return {
      mirrorCleared: true,
      operationsDiscarded: discard ? pending : 0,
      operationsKept: discard ? 0 : pending,
    };
  } finally {
    db.close();
  }
}

// D-3, D-7, invariant 7: the mirror is disposable; unsent work goes only if the user chose it.
export async function purgeVault(
  userId: string,
  options: VaultPurgeOptions = {},
): Promise<VaultPurgeOutcome> {
  if (!isVaultSupported() || !(await vaultExists(userId))) return NOTHING;
  const outcome = await clearVault(userId, options);
  if (outcome.mirrorCleared) forgetOfflineReadyAnnouncement();
  return outcome;
}

export async function purgeOtherVaults(userId: string): Promise<void> {
  const others = await otherVaultUsers(userId);
  const outcomes = await Promise.all(
    others.map((other) => clearVault(other, { discardPendingWork: false })),
  );
  if (outcomes.some((outcome) => outcome.mirrorCleared)) forgetOfflineReadyAnnouncement();
}
