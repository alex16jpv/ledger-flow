"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ApiError, type ErrorMessageKey, presentError } from "@/lib/api/errors";
import { noteSessionStarted, refreshSession } from "@/lib/api/refresh";
import { readSessionMarker } from "@/lib/auth/marker";
import { APP_HOME_PATH, KEEP_OR_START_FRESH_PATH } from "@/lib/auth/routes";
import { formatCountdown } from "@/lib/hooks/useCountdown";
import { useRouter } from "@/lib/i18n/navigation";
import { readVaultProfile } from "@/lib/local/db";
import { pullNow } from "@/lib/local/mirror";
import { purgeOtherVaults, purgeVault } from "@/lib/local/purge";
import { reportOnline } from "@/lib/network/connectivity";
import { setLocalOnly } from "@/lib/network/local-only";
import { reportError } from "@/lib/observability/reporter";
import { fetchCurrentUser, type SessionUser } from "@/lib/session/api";
import { tabChannel } from "@/lib/session/channel";
import { sessionKeys } from "@/lib/session/keys";
import type { KeepOrStartFreshInput } from "@/types/api";

import {
  answerKeepOrStartFresh,
  confirmEmailWithCode,
  confirmEmailWithLink,
  deleteAccountThatUsedMyEmail,
  login,
  register,
  requestResetCode,
  resetPassword,
  sendVerificationCode,
} from "./api";

export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export type FailureKey = "auth.sendFailed" | ErrorMessageKey;

export function failureKey(error: unknown): FailureKey {
  return error instanceof ApiError && error.status < 500
    ? presentError(error).messageKey
    : "auth.sendFailed";
}

export function retryAfterOf(error: unknown): number | null {
  if (error instanceof ApiError && error.status === 429) {
    return error.retryAfterSeconds ?? RATE_LIMIT_WINDOW_SECONDS;
  }
  return null;
}

async function syncFromNowOn({ user }: SessionUser): Promise<void> {
  noteSessionStarted();
  setLocalOnly(false);
  reportOnline(true);
  await purgeOtherVaults(user.id).catch((error: unknown) => {
    reportError(error, "vault");
  });
  tabChannel.post({ type: "session:signedIn" });
}

export function useLogin() {
  return useMutation({ mutationFn: login, onSuccess: syncFromNowOn });
}

export function useRegister() {
  return useMutation({ mutationFn: register, onSuccess: syncFromNowOn });
}

export function useRequestResetCode() {
  return useMutation({
    mutationFn: ({ email, captcha }: { email: string; captcha: string }) =>
      requestResetCode(email, captcha),
  });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword, onSuccess: syncFromNowOn });
}

const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;

export async function withFreshSession<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isUnauthorized(error) || !(await refreshSession())) throw error;
    return run();
  }
}

export function fetchSessionUser(): Promise<SessionUser> {
  return withFreshSession(fetchCurrentUser);
}

export function useFinishReset(): (session: SessionUser) => void {
  const router = useRouter();
  return useCallback(
    ({ user }: SessionUser) => {
      if (user.keepOrStartFresh) router.replace(KEEP_OR_START_FRESH_PATH);
      else router.replace({ pathname: APP_HOME_PATH, query: { passwordChanged: "1" } });
    },
    [router],
  );
}

export async function dropThisCopy(userId: string): Promise<void> {
  await purgeVault(userId, { discardPendingWork: false }).catch((error: unknown) => {
    reportError(error, "vault");
  });
}

export function useKeepOrStartFresh(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answer: KeepOrStartFreshInput) => answerKeepOrStartFresh(userId, answer),
    onSuccess: async (user, answer) => {
      queryClient.setQueryData(sessionKeys.me(), { user });
      if (answer.choice === "start-fresh") await dropThisCopy(user.id);
    },
  });
}

const HOUR_SECONDS = 3600;

export function useWaitText(): (seconds: number) => string {
  const t = useTranslations("common");
  return useCallback(
    (seconds: number) =>
      seconds < HOUR_SECONDS
        ? formatCountdown(seconds)
        : t("hoursMinutes", {
            hours: Math.floor(seconds / HOUR_SECONDS),
            minutes: Math.floor((seconds % HOUR_SECONDS) / 60),
          }),
    [t],
  );
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

function useEmailConfirmed(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
    void pullNow().catch(() => undefined);
  }, [queryClient]);
}

export function useConfirmEmailCode() {
  const confirmed = useEmailConfirmed();
  return useMutation({
    mutationFn: (code: string) => withFreshSession(() => confirmEmailWithCode(code)),
    onSuccess: confirmed,
  });
}

export function useSendVerificationCode() {
  const confirmed = useEmailConfirmed();
  return useMutation({
    mutationFn: (captcha: string) => withFreshSession(() => sendVerificationCode(captcha)),
    onError: (error) => {
      if (error instanceof ApiError && error.code === "EMAIL_ALREADY_VERIFIED") confirmed();
    },
  });
}

export function useConfirmEmailLink() {
  const confirmed = useEmailConfirmed();
  return useMutation({ mutationFn: confirmEmailWithLink, onSuccess: confirmed });
}

export function useDeleteAccountThatUsedMyEmail() {
  return useMutation({ mutationFn: deleteAccountThatUsedMyEmail });
}
