import { noteSessionEnded } from "@/lib/api/refresh";
import { SESSION_COOKIE, sessionMarkerCookie } from "@/lib/auth/cookies";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { localePrefix } from "@/lib/i18n/locales";
import { setLocalOnly } from "@/lib/network/local-only";
import { forgetOfflineReadyAnnouncement } from "@/lib/pwa/readiness";
import { purgePersistedCaches } from "@/lib/query/purge";
import { requestLogout } from "@/lib/session/api";
import { appliedProfile } from "@/lib/session/applied-profile";
import { tabChannel } from "@/lib/session/channel";
import { unsentTheme } from "@/lib/theme/unsent";

import { dropDatabase, isVaultSupported } from "./db";
import { forgetVaultsOpened } from "./evicted";
import { currentVault, setCurrentVault } from "./repository";
import { VAULT_DB_PREFIX } from "./schema";

// §2.6: a wipe that left the marker would send the user back to the same sheet.
export function clearSessionMarker(): void {
  const spec = sessionMarkerCookie("x");
  document.cookie = `${SESSION_COOKIE}=; Path=${spec.path}; Max-Age=0; SameSite=Lax; Secure`;
}

async function endServerSession(): Promise<void> {
  noteSessionEnded();
  // Offline the session cookies outlive the wipe, but with no marker nothing on this device uses them.
  await requestLogout().catch(() => undefined);
}

async function dropVaults(): Promise<void> {
  if (!isVaultSupported() || typeof indexedDB.databases !== "function") return;
  const names = (await indexedDB.databases())
    .map((database) => database.name)
    .filter((name): name is string => typeof name === "string" && name.startsWith(VAULT_DB_PREFIX));
  await Promise.all(names.map(dropDatabase));
}

export async function wipeThisDevice(): Promise<void> {
  // F-31: the handle goes first — a delete is blocked while any connection is open.
  currentVault()?.close();
  setCurrentVault(null);
  clearSessionMarker();
  forgetVaultsOpened();
  forgetOfflineReadyAnnouncement();
  unsentTheme.clear();
  appliedProfile.forget();
  await purgePersistedCaches();
  await dropVaults();
  tabChannel.post({ type: "device:wiped" });
  setLocalOnly(false);
  await endServerSession();
}

// A full load, not a client navigation: after a wipe nothing in memory may survive.
export function loadSignInAfterWipe(locale: string): void {
  window.location.assign(
    new URL(`${localePrefix(locale)}${LOGIN_PATH}?wiped=1`, window.location.origin),
  );
}
