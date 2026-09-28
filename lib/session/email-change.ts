"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { noteSessionStarted, withFreshSession } from "@/lib/api/refresh";
import { pullNow } from "@/lib/local/mirror";
import type { EmailChange, EmailChangeSent, RequestEmailChangeInput, User } from "@/types/api";

import type { SessionUser } from "./api";
import { sessionKeys } from "./keys";

export type EmailChangeRequest = Omit<RequestEmailChangeInput, "deviceToken">;

export function requestEmailChange(input: EmailChangeRequest): Promise<EmailChangeSent> {
  return api<EmailChangeSent>("/auth/change-email", { method: "POST", body: input });
}

export function resendEmailChange(captcha: string): Promise<EmailChangeSent> {
  return api<EmailChangeSent>("/auth/change-email/resend", {
    method: "POST",
    body: { captcha },
  });
}

export function cancelEmailChange(): Promise<unknown> {
  return api("/auth/change-email", { method: "DELETE" });
}

export function confirmEmailChangeWithCode(code: string): Promise<{ user: User }> {
  return api<{ user: User }>("/auth/confirm-change", { method: "POST", body: { code } });
}

export function confirmEmailChangeWithLink(token: string): Promise<unknown> {
  return api("/auth/confirm-change", { method: "POST", body: { token } });
}

export function changeNoLongerWaits(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "EMAIL_CHANGE_NOT_PENDING" || error.code === "EMAIL_TAKEN")
  );
}

function useSetEmailChange(): (emailChange: EmailChange | null) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (emailChange: EmailChange | null) => {
      queryClient.setQueryData<SessionUser>(
        sessionKeys.me(),
        (current) => current && { user: { ...current.user, emailChange } },
      );
    },
    [queryClient],
  );
}

function useDropWhenGone(): (error: unknown) => void {
  const setEmailChange = useSetEmailChange();
  return useCallback(
    (error: unknown) => {
      if (changeNoLongerWaits(error)) setEmailChange(null);
    },
    [setEmailChange],
  );
}

export function useRequestEmailChange() {
  const setEmailChange = useSetEmailChange();
  return useMutation({
    mutationFn: (input: EmailChangeRequest) => withFreshSession(() => requestEmailChange(input)),
    onSuccess: ({ emailChange }) => {
      setEmailChange(emailChange);
    },
  });
}

export function useResendEmailChange() {
  const setEmailChange = useSetEmailChange();
  const dropWhenGone = useDropWhenGone();
  return useMutation({
    mutationFn: (captcha: string) => withFreshSession(() => resendEmailChange(captcha)),
    onSuccess: ({ emailChange }) => {
      setEmailChange(emailChange);
    },
    onError: dropWhenGone,
  });
}

export function useCancelEmailChange() {
  const setEmailChange = useSetEmailChange();
  return useMutation({
    mutationFn: () => withFreshSession(cancelEmailChange),
    onSuccess: () => {
      setEmailChange(null);
    },
  });
}

// The move signs out every other session; this one comes back with a new pair, as after a reset.
export function useConfirmEmailChangeCode() {
  const queryClient = useQueryClient();
  const dropWhenGone = useDropWhenGone();
  return useMutation({
    mutationFn: (code: string) => withFreshSession(() => confirmEmailChangeWithCode(code)),
    onSuccess: ({ user }) => {
      noteSessionStarted();
      queryClient.setQueryData<SessionUser>(sessionKeys.me(), {
        user: { ...user, emailChange: null, emailVerification: null },
      });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      void pullNow().catch(() => undefined);
    },
    onError: dropWhenGone,
  });
}
