"use client";

import { useMutation } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";
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
