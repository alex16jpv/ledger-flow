import { SHELL_CACHE, SHELL_SCREENS, shellCacheKey, shellUrls } from "./shell";

export interface ShellReadiness {
  cached: number;
  expected: number;
}

// F-54: once per device, not per session — the shell it counts is the origin's.
const ANNOUNCED_KEY = "ledger-flow.offline-ready-announced";

// The Cache API answers the window too, so no message protocol; locale-aware on purpose.
export async function shellReadiness(locale: string): Promise<ShellReadiness> {
  if (typeof caches === "undefined") return { cached: 0, expected: SHELL_SCREENS };
  const urls = shellUrls(locale, window.location.origin);
  const cache = await caches.open(SHELL_CACHE);
  let cached = 0;
  for (const url of urls) {
    if (await cache.match(shellCacheKey(url), { ignoreVary: true })) cached += 1;
  }
  return { cached, expected: urls.length };
}

export function offlineReadyAnnounced(): boolean {
  try {
    return window.localStorage.getItem(ANNOUNCED_KEY) === "1";
  } catch {
    // A browser that refuses storage announces it every time, which is better than not at all.
    return false;
  }
}

// The copy it was said of is gone, so the next one that finishes announces itself again.
export function forgetOfflineReadyAnnouncement(): void {
  try {
    window.localStorage.removeItem(ANNOUNCED_KEY);
  } catch {
    return;
  }
}

export function markOfflineReadyAnnounced(): void {
  try {
    window.localStorage.setItem(ANNOUNCED_KEY, "1");
  } catch {
    return;
  }
}
