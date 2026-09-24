"use client";

import { parseSessionMarker, SESSION_COOKIE, type SessionMarker } from "./cookies";

// §2.6: the marker decides whose vault opens, never that the session is valid — the API answers.
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

// §2.6: another user signing in on this device changes the cookies every one of its tabs sends.
export function sessionIsFor(userId: string): boolean {
  const marker = readSessionMarker();
  return marker === null || marker.userId === userId;
}

export type SessionResolution = "loading" | "resolved";

// §2.6: while the session is still loading nobody opens anything, or /me races into another user.
export function vaultUserFor(
  sessionUserId: string | undefined,
  resolution: SessionResolution,
  marker: SessionMarker | null,
): string | undefined {
  if (sessionUserId) return sessionUserId;
  if (resolution === "loading") return undefined;
  return marker?.userId;
}
