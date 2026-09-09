import { SESSION_COOKIE, sessionMarkerCookie } from "@/lib/auth/cookies";
import { purgePersistedCaches } from "@/lib/query/purge";

import { isVaultSupported } from "./db";
import { currentVault, setCurrentVault } from "./repository";
import { VAULT_DB_PREFIX } from "./schema";

// P-32 (owner, 2026-09-08): the third exit. It deletes the copy of the user's data on this device
// and everything still queued — the only place in the app where unsent work goes without reaching
// the server, and it does so because the user was told the number and said yes (invariant 7 asks for
// exactly that). The account on the server is not touched.
async function dropDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      resolve();
    };
    // Another tab holding the database open: the delete lands when it closes, and waiting here
    // would hang the screen on a tab nobody is looking at.
    request.onblocked = () => {
      resolve();
    };
  });
}

// The marker is the reason a device with no session still opens its vault (§2.6), so a wipe that
// left it behind would send the user straight back to the same sheet. It is not httpOnly, which is
// what makes it the app's to clear.
export function clearSessionMarker(): void {
  const spec = sessionMarkerCookie("x");
  document.cookie = `${SESSION_COOKIE}=; Path=${spec.path}; Max-Age=0; SameSite=Lax; Secure`;
}

export async function wipeThisDevice(): Promise<void> {
  // The handle has to go first: a delete is blocked while any connection is open, and the screens
  // read through this gate (F-31).
  currentVault()?.close();
  setCurrentVault(null);
  clearSessionMarker();
  await purgePersistedCaches();
  if (!isVaultSupported() || typeof indexedDB.databases !== "function") return;
  const names = (await indexedDB.databases())
    .map((database) => database.name)
    .filter((name): name is string => typeof name === "string" && name.startsWith(VAULT_DB_PREFIX));
  await Promise.all(names.map(dropDatabase));
}
