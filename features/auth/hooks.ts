"use client";

import { useMutation } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";

import { login } from "./api";

export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export function retryAfterOf(error: unknown): number | null {
  if (error instanceof ApiError && error.status === 429) {
    return error.retryAfterSeconds ?? RATE_LIMIT_WINDOW_SECONDS;
  }
  return null;
}

export function useLogin() {
  return useMutation({ mutationFn: login });
}
