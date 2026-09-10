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
