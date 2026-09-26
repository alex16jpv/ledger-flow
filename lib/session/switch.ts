"use client";

import type { SessionMarker } from "@/lib/auth/cookies";

type SessionChange = "switched" | "resumed";

const SWITCHED_KEY = "lf:account-switched";

export function sessionChangeOf(
  owner: string,
  mounted: SessionMarker | null,
  current: SessionMarker | null,
  expired: boolean,
): SessionChange | null {
  if (!current) return null;
  if (current.userId !== (mounted?.userId ?? owner)) return "switched";
  if (expired && !Object.is(current.issuedAt, mounted?.issuedAt)) return "resumed";
  return null;
}

export function noteAccountSwitched(): void {
  try {
    window.sessionStorage.setItem(SWITCHED_KEY, "1");
  } catch {
    return;
  }
}

export function takeAccountSwitched(): boolean {
  try {
    const switched = window.sessionStorage.getItem(SWITCHED_KEY) === "1";
    window.sessionStorage.removeItem(SWITCHED_KEY);
    return switched;
  } catch {
    return false;
  }
}
