import { reportError } from "@/lib/observability/reporter";
import { type DisplayMode, displayMode } from "@/lib/pwa/mode";

import { canListVaults, vaultExists } from "./db";

const LAST_OPENED_PREFIX = "lf:vault-opened-at:";

const lastOpenedKey = (userId: string): string => `${LAST_OPENED_PREFIX}${userId}`;

// A timestamp, not a token and not personal data: it is the only way to tell how long a vault had
// been sitting before the browser took it, because eviction takes the vault's own `meta` with it.
function readLastOpened(userId: string): number | null {
  try {
    const value = Number(localStorage.getItem(lastOpenedKey(userId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function noteVaultOpened(userId: string, now = Date.now()): void {
  try {
    localStorage.setItem(lastOpenedKey(userId), String(now));
  } catch {
    // Private mode, or storage denied: the eviction event loses a field, nothing else.
  }
}

// The third exit deletes the vaults itself, so the marks have to go with them or the next sign-in
// reads its own wipe as an eviction.
export function forgetVaultsOpened(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(LAST_OPENED_PREFIX));
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Same storage denial as above: nothing was written, so there is nothing to forget.
  }
}

export class VaultEvictedError extends Error {
  readonly mode: DisplayMode;
  readonly daysSinceLastOpen: number | null;
  readonly daysSinceMarker: number | null;

  constructor(mode: DisplayMode, daysSinceLastOpen: number | null, daysSinceMarker: number | null) {
    super(
      `vault_evicted mode=${mode} daysSinceLastOpen=${daysSinceLastOpen ?? "unknown"} daysSinceMarker=${daysSinceMarker ?? "unknown"}`,
    );
    this.name = "VaultEvictedError";
    this.mode = mode;
    this.daysSinceLastOpen = daysSinceLastOpen;
    this.daysSinceMarker = daysSinceMarker;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// WebKit clears script-writable storage after seven days without a visit; that is the deadline D-20
// set out to measure, and the floor under which a missing vault is one this device never opened.
const EVICTION_FLOOR_DAYS = 7;

const daysSince = (at: number | null | undefined, now: number): number | null =>
  at === null || at === undefined || !Number.isFinite(at) ? null : Math.floor((now - at) / DAY_MS);

// D-20: the marker says this device had a session for this user. If the vault is not there and the
// device did open one, the browser took it, and the real WebKit deadline is whatever these events
// say it is — that is the measurement the plan stopped building a separate page for.
export async function reportVaultEvictionIfAny(
  userId: string,
  markerIssuedAt: number,
  now = Date.now(),
): Promise<boolean> {
  if (!canListVaults()) return false;
  if (await vaultExists(userId)) return false;
  const sinceLastOpen = daysSince(readLastOpened(userId), now);
  const sinceMarker = daysSince(markerIssuedAt, now);
  // The marker is stamped at sign-in, before the vault exists: under the deadline, and with no mark
  // of an open vault, the honest answer is that this device never had one.
  if (sinceLastOpen === null && (sinceMarker === null || sinceMarker < EVICTION_FLOOR_DAYS))
    return false;
  reportError(new VaultEvictedError(displayMode(), sinceLastOpen, sinceMarker), "vault");
  return true;
}
