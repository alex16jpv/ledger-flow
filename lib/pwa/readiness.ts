import { SHELL_CACHE, SHELL_SCREENS, shellCacheKey, shellUrls } from "./shell";

export interface ShellReadiness {
  cached: number;
  expected: number;
}

// Announced once per device, not once per session: "Ready to use offline" is news the first time
// and noise every time after it (F-54). A device, not a user — the shell it counts is the origin's.
const ANNOUNCED_KEY = "ledger-flow.offline-ready-announced";

// How much of the app this device holds. The page counts the keys the warm should have left in the
// worker's cache: the Cache API answers the window too, so this is the same number a round-trip to
// the worker would give, without a message protocol to keep in step. Locale-aware on purpose — a
// device that only ever ran in Spanish is not ready for English it never warmed.
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

export function markOfflineReadyAnnounced(): void {
  try {
    window.localStorage.setItem(ANNOUNCED_KEY, "1");
  } catch {
    return;
  }
}
