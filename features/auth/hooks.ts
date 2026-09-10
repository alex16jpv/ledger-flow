"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/errors";
import { readSessionMarker } from "@/lib/auth/marker";
import { readVaultProfile } from "@/lib/local/db";
import { reportOnline } from "@/lib/network/connectivity";
import { setLocalOnly } from "@/lib/network/local-only";

import { login, register } from "./api";

export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export function retryAfterOf(error: unknown): number | null {
  if (error instanceof ApiError && error.status === 429) {
    return error.retryAfterSeconds ?? RATE_LIMIT_WINDOW_SECONDS;
  }
  return null;
}

// P-36: signing in is how the user unmakes "this device only" — the sheet of P-32 sends them here
// for exactly that, and the choice outlived the sign-in, so the app came back with a live session
// and a stripe still saying nothing was syncing. The answer that just arrived is also the proof of
// network the mode refuses to take from anywhere else.
function syncFromNowOn(): void {
  setLocalOnly(false);
  reportOnline(true);
}

export function useLogin() {
  return useMutation({ mutationFn: login, onSuccess: syncFromNowOn });
}

export function useRegister() {
  return useMutation({ mutationFn: register, onSuccess: syncFromNowOn });
}

// P-37: coming back to sync is not a first sign-in. The marker says whose device this is (§2.6) and
// the mirror keeps that user's profile, so the only thing the screen is missing is the password.
// Null on a device with no vault, which is exactly where a first sign-in happens.
export function useDeviceEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const marker = readSessionMarker();
    if (!marker) return undefined;
    let wanted = true;
    void readVaultProfile(marker.userId)
      .then((profile) => {
        if (wanted && profile) setEmail(profile.email);
      })
      .catch(() => undefined);
    return () => {
      wanted = false;
    };
  }, []);
  return email;
}
