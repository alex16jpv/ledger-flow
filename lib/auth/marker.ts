"use client";

import { parseSessionMarker, SESSION_COOKIE, type SessionMarker } from "./cookies";

// The one thing the marker is allowed to decide: whose vault this device opens when the session
// cannot be resolved (§2.6). It is never a claim that the session is valid — the API answers that.
export function readSessionMarker(): SessionMarker | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    return parseSessionMarker(decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return null;
}

export type SessionResolution = "loading" | "resolved";

// §2.6 in one place: the session decides while it can, and only once it has given up does the
// marker get to name the vault. While it is still loading nobody opens anything, or a slow /me
// would race the marker into the wrong user's data.
export function vaultUserFor(
  sessionUserId: string | undefined,
  resolution: SessionResolution,
  marker: SessionMarker | null,
): string | undefined {
  if (sessionUserId) return sessionUserId;
  if (resolution === "loading") return undefined;
  return marker?.userId;
}
