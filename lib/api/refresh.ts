import { tabChannel } from "@/lib/session/channel";

import { API_PREFIX } from "./client";
import { isErrorCode } from "./errors";

export const REFRESH_LOCK = "lf-refresh";

let inFlight: Promise<boolean> | null = null;
let lastRefreshAt = 0;

interface RefreshOptions {
  since?: number;
}

async function requestRefresh(): Promise<boolean> {
  const response = await fetch(`${API_PREFIX}/auth/refresh`, {
    method: "POST",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (response.ok) {
    lastRefreshAt = Date.now();
    tabChannel.post({ type: "session:refreshed", at: lastRefreshAt });
    return true;
  }
  if (response.status === 401) {
    const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
    const code = isErrorCode(body?.code) ? body.code : null;
    if (code === "REFRESH_INVALID" || code === "REFRESH_REVOKED" || code === null) {
      tabChannel.emitLocal({ type: "session:expired" });
      tabChannel.post({ type: "session:expired" });
    }
  }
  return false;
}

async function withLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return run();
  return locks.request(REFRESH_LOCK, run);
}

// Every 401 in a tab funnels into one refresh; the Web Lock keeps two tabs from rotating the same token.
export function refreshSession({ since = Date.now() }: RefreshOptions = {}): Promise<boolean> {
  if (lastRefreshAt > since) return Promise.resolve(true);
  inFlight ??= withLock(async () => {
    if (lastRefreshAt > since) return true;
    return requestRefresh();
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function noteRefreshedElsewhere(at: number): void {
  lastRefreshAt = Math.max(lastRefreshAt, at);
}

export function resetRefreshState(): void {
  inFlight = null;
  lastRefreshAt = 0;
}
