import { SESSION_COOKIE, sessionMarkerCookie } from "@/lib/auth/cookies";
import { forgetOfflineReadyAnnouncement } from "@/lib/pwa/readiness";
import { purgePersistedCaches } from "@/lib/query/purge";

import { isVaultSupported } from "./db";
import { forgetVaultsOpened } from "./evicted";
import { currentVault, setCurrentVault } from "./repository";
import { VAULT_DB_PREFIX } from "./schema";

// P-32 (owner, 2026-09-08): invariant 7 is met by telling the user the number first.
async function dropDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      resolve();
    };
    // Another tab holds it open: the delete lands when it closes, and waiting would hang.
    request.onblocked = () => {
      resolve();
    };
  });
}

// §2.6: a wipe that left the marker would send the user back to the same sheet.
export function clearSessionMarker(): void {
  const spec = sessionMarkerCookie("x");
  document.cookie = `${SESSION_COOKIE}=; Path=${spec.path}; Max-Age=0; SameSite=Lax; Secure`;
}

export async function wipeThisDevice(): Promise<void> {
  // F-31: the handle goes first — a delete is blocked while any connection is open.
  currentVault()?.close();
  setCurrentVault(null);
  clearSessionMarker();
  forgetVaultsOpened();
  forgetOfflineReadyAnnouncement();
  await purgePersistedCaches();
  if (!isVaultSupported() || typeof indexedDB.databases !== "function") return;
  const names = (await indexedDB.databases())
    .map((database) => database.name)
    .filter((name): name is string => typeof name === "string" && name.startsWith(VAULT_DB_PREFIX));
  await Promise.all(names.map(dropDatabase));
}
