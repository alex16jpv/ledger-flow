import { openDB } from "idb";

import { forgetOfflineReadyAnnouncement } from "@/lib/pwa/readiness";

import { isVaultSupported, vaultExists } from "./db";
import { MIRROR_STORES, vaultDatabaseName, type VaultSchema } from "./schema";

type VaultStore =
  "profile" | "accounts" | "categories" | "transactions" | "budgets" | "meta" | "outbox";

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

// D-3, D-7, invariant 7: the mirror is disposable; unsent work goes only if the user chose it.
export async function purgeVault(
  userId: string,
  options: VaultPurgeOptions = {},
): Promise<VaultPurgeOutcome> {
  if (!isVaultSupported() || !(await vaultExists(userId))) return NOTHING;

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
      if (discard) await meta.delete("outboxSeq");
    }
    if (discard && names.includes("outbox")) await tx.objectStore("outbox").clear();
    await tx.done;

    forgetOfflineReadyAnnouncement();
    return {
      mirrorCleared: true,
      operationsDiscarded: discard ? pending : 0,
      operationsKept: discard ? 0 : pending,
    };
  } finally {
    db.close();
  }
}
