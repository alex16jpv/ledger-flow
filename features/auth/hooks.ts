"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { ApiError, type ErrorMessageKey, NetworkError, presentError } from "@/lib/api/errors";
import { noteSessionStarted, withFreshSession } from "@/lib/api/refresh";
import { readSessionMarker } from "@/lib/auth/marker";
import { APP_HOME_PATH, CONFIRM_TO_CONTINUE_PATH } from "@/lib/auth/routes";
import { useRouter } from "@/lib/i18n/navigation";
import { readVaultProfile } from "@/lib/local/db";
import { pullNow } from "@/lib/local/mirror";
import { purgeOtherVaults } from "@/lib/local/purge";
import { reportOnline } from "@/lib/network/connectivity";
import { setLocalOnly } from "@/lib/network/local-only";
import { reportError } from "@/lib/observability/reporter";
import { fetchCurrentUser, type SessionProfile, type SessionUser } from "@/lib/session/api";
import { tabChannel } from "@/lib/session/channel";
import { confirmEmailChangeWithLink } from "@/lib/session/email-change";
import { sessionKeys } from "@/lib/session/keys";

import {
  confirmEmailWithCode,
  confirmEmailWithLink,
  confirmSignUp,
  forgetPendingSignUp,
  login,
  readPendingSignUp,
  requestResetCode,
  resendSignUpCode,
  resetPassword,
  type ResetSession,
  restoreDeletedAccount,
  restoreFromLink,
  sendVerificationCode,
  startSignUp,
} from "./api";
import { authKeys } from "./keys";

export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export type FailureKey = "auth.sendFailed" | ErrorMessageKey;

export function failureKey(error: unknown): FailureKey {
  return (error instanceof ApiError && error.status < 500) || error instanceof NetworkError
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

export function useRestoreDeletedAccount() {
  return useMutation({ mutationFn: restoreDeletedAccount, onSuccess: syncFromNowOn });
}

export function pathAfterSignIn(user: SessionProfile, next: string): string {
  return user.emailConfirmationRequired ? CONFIRM_TO_CONTINUE_PATH : next;
}

export function usePendingSignUp() {
  return useQuery({
    queryKey: authKeys.pendingSignUp(),
    queryFn: readPendingSignUp,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    networkMode: "always",
  });
}

export function useStartSignUp() {
  return useMutation({ mutationFn: startSignUp });
}

export function useResendSignUpCode() {
  return useMutation({ mutationFn: resendSignUpCode });
}

export function useForgetPendingSignUp() {
  return useMutation({ mutationFn: forgetPendingSignUp });
}

export function useConfirmSignUp() {
  return useMutation({ mutationFn: confirmSignUp, onSuccess: syncFromNowOn });
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

export function fetchSessionUser(): Promise<SessionUser> {
  return withFreshSession(fetchCurrentUser);
}

export function useFinishReset(): (session: ResetSession) => void {
  const router = useRouter();
  return useCallback(
    ({ restored }: ResetSession) => {
      router.replace({
        pathname: APP_HOME_PATH,
        query: restored ? { passwordChanged: "1", restored: "1" } : { passwordChanged: "1" },
      });
    },
    [router],
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

export function useConfirmEmailChangeLink() {
  const confirmed = useEmailConfirmed();
  return useMutation({ mutationFn: confirmEmailChangeWithLink, onSuccess: confirmed });
}

export function useRestoreFromLink() {
  return useMutation({ mutationFn: restoreFromLink });
}
