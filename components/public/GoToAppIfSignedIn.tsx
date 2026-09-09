"use client";

import { useEffect } from "react";

import { readSessionMarker } from "@/lib/auth/marker";
import { APP_HOME_PATH } from "@/lib/auth/routes";

// P-33 (owner, 2026-09-08): a device that already holds the app must not land on the pitch. Online
// the proxy redirects before anything renders; this covers the case the proxy cannot see — no
// network, where the worker answers the landing from its cache. The marker is the documented signal
// that this device has a vault (§2.6), and a crawler never carries it.
export function GoToAppIfSignedIn() {
  useEffect(() => {
    if (!readSessionMarker()) return;
    window.location.replace(`${window.location.origin}${APP_HOME_PATH}`);
  }, []);
  return null;
}
