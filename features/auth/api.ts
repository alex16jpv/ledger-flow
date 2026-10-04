import { api } from "@/lib/api/client";
import type { SessionUser } from "@/lib/session/api";
import type {
  EmailChangeUndone,
  EmailVerified,
  ForgotPasswordAccepted,
  PasswordResetDone,
  ResetPasswordInput,
  RestoreLinkUsed,
  SignUpInput,
  VerificationCodeSent,
} from "@/types/api";

import type { LoginValues } from "./schemas";

export function login(values: LoginValues): Promise<SessionUser> {
  return api<SessionUser>("/auth/login", { method: "POST", body: values });
}

export function restoreDeletedAccount(values: LoginValues): Promise<SessionUser> {
  return api<SessionUser>("/auth/login/restore", { method: "POST", body: values });
}

export type SignUpValues = Required<Omit<SignUpInput, "deviceToken">>;

export interface PendingSignUp {
  email: string;
  expiresAt: string;
  resendAfterSeconds: number;
}

export function startSignUp(values: SignUpValues): Promise<PendingSignUp> {
  return api<PendingSignUp>("/auth/sign-up", { method: "POST", body: values });
}

export function readPendingSignUp(): Promise<PendingSignUp | null> {
  return api<PendingSignUp | null>("/auth/sign-up");
}

export function forgetPendingSignUp(): Promise<unknown> {
  return api("/auth/sign-up", { method: "DELETE" });
}

export function resendSignUpCode(captcha: string): Promise<PendingSignUp> {
  return api<PendingSignUp>("/auth/sign-up/resend", { method: "POST", body: { captcha } });
}

export function confirmSignUp(code: string): Promise<SessionUser> {
  return api<SessionUser>("/auth/sign-up/confirm", { method: "POST", body: { code } });
}

export function requestResetCode(email: string, captcha: string): Promise<ForgotPasswordAccepted> {
  return api<ForgotPasswordAccepted>("/auth/forgot", {
    method: "POST",
    body: { email, captcha },
  });
}

export type ResetSession = SessionUser & Partial<Pick<PasswordResetDone, "restored">>;

export function resetPassword(input: ResetPasswordInput): Promise<ResetSession> {
  return api<ResetSession>("/auth/reset", { method: "POST", body: input });
}

export function confirmEmailWithCode(code: string): Promise<unknown> {
  return api("/auth/verify", { method: "POST", body: { code } });
}

export function confirmEmailWithLink(token: string): Promise<EmailVerified> {
  return api<EmailVerified>("/auth/verify", { method: "POST", body: { token } });
}

export function sendVerificationCode(captcha: string): Promise<VerificationCodeSent> {
  return api<VerificationCodeSent>("/auth/resend", { method: "POST", body: { captcha } });
}

export function restoreFromLink(token: string): Promise<RestoreLinkUsed> {
  return api<RestoreLinkUsed>("/auth/restore", { method: "POST", body: { token } });
}

export function undoEmailChange(token: string): Promise<EmailChangeUndone> {
  return api<EmailChangeUndone>("/auth/undo", { method: "POST", body: { token } });
}
