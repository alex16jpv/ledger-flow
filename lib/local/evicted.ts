import { reportError } from "@/lib/observability/reporter";
import { type DisplayMode, displayMode } from "@/lib/pwa/mode";

import { vaultExists } from "./db";

const LAST_OPENED_KEY = "lf:vault-opened-at";

// A timestamp, not a token and not personal data: it is the only way to tell how long a vault had
// been sitting before the browser took it, because eviction takes the vault's own `meta` with it.
function readLastOpened(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_OPENED_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function noteVaultOpened(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_OPENED_KEY, String(now));
  } catch {
    // Private mode, or storage denied: the eviction event loses a field, nothing else.
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

const daysSince = (at: number | null | undefined, now: number): number | null =>
  at === null || at === undefined || !Number.isFinite(at) ? null : Math.floor((now - at) / DAY_MS);

// D-20: the marker says this device had a vault for this user. If the vault is not there, the
// browser took it, and the real WebKit deadline is whatever these events say it is — that is the
// measurement the plan stopped building a separate page for.
export async function reportVaultEvictionIfAny(
  userId: string,
  markerIssuedAt: number,
  now = Date.now(),
): Promise<boolean> {
  if (await vaultExists(userId)) return false;
  const lastOpened = readLastOpened();
  // A device that never opened a vault has nothing to have lost.
  if (lastOpened === null && !Number.isFinite(markerIssuedAt)) return false;
  reportError(
    new VaultEvictedError(
      displayMode(),
      daysSince(lastOpened, now),
      daysSince(markerIssuedAt, now),
    ),
    "vault",
  );
  return true;
}
