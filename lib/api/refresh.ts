import {
  isSessionEnd,
  SESSION_END_HEADER,
  type SessionEnd,
  SessionEndedError,
} from "@/lib/auth/session-end";
import { resumeSyncEngine } from "@/lib/local/outbox/engine";
import { reportNetworkAnswer, reportNetworkFailure } from "@/lib/network/connectivity";
import { reportError } from "@/lib/observability/reporter";
import { tabChannel } from "@/lib/session/channel";

import { API_PREFIX } from "./client";
import { NetworkError } from "./errors";
import { newRequestId } from "./request-id";

export const REFRESH_LOCK = "lf-refresh";

// One second chance before believing an answer nobody signed, or none at all.
const RETRY_DELAY_MS = 500;

let inFlight: Promise<boolean> | null = null;
let lastRefreshAt = 0;

interface RefreshOptions {
  since?: number;
}

async function post(): Promise<Response | null> {
  try {
    const response = await fetch(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    reportNetworkAnswer();
    return response;
  } catch {
    reportNetworkFailure();
    return null;
  }
}

// H-10: a 401 the BFF did not sign is an edge or a gateway, and knows nothing about this token.
function endedBy(response: Response | null): SessionEnd | null {
  if (response?.status !== 401) return null;
  const by = response.headers.get(SESSION_END_HEADER);
  return isSessionEnd(by) ? by : null;
}

async function codeOf(response: Response): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
  return typeof body?.code === "string" ? body.code : null;
}

async function requestRefresh(): Promise<boolean> {
  let response = await post();
  if (!response?.ok && !endedBy(response)) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    response = await post();
  }
  if (response?.ok) {
    lastRefreshAt = Date.now();
    tabChannel.post({ type: "session:refreshed", at: lastRefreshAt });
    // Whatever the queue stopped on when the session died can go out again (F-26).
    resumeSyncEngine();
    return true;
  }
  const by = endedBy(response);
  if (by && response) {
    // Which side ended it is the difference between a token that is over and a bad minute.
    reportError(new SessionEndedError(by, await codeOf(response)), "session");
    tabChannel.emitLocal({ type: "session:expired" });
    tabChannel.post({ type: "session:expired" });
    return false;
  }
  // Twice with no answer at all says nothing about the session and everything about the network.
  if (!response) throw new NetworkError(newRequestId(), false);
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
