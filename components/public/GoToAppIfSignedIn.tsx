"use client";

import { useEffect } from "react";

import { readSessionMarker } from "@/lib/auth/marker";
import { APP_HOME_PATH } from "@/lib/auth/routes";

// P-33: with no network the proxy cannot redirect, so the marker (§2.6) does it here.
export function GoToAppIfSignedIn() {
  useEffect(() => {
    if (!readSessionMarker()) return;
    window.location.replace(`${window.location.origin}${APP_HOME_PATH}`);
  }, []);
  return null;
}
