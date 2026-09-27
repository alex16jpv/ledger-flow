import { api } from "@/lib/api/client";
import type { SessionUser } from "@/lib/session/api";
import type {
  ForgotPasswordAccepted,
  KeepOrStartFreshInput,
  RegisterInput as RegisterBody,
  ResetPasswordInput,
  User,
  VerificationCodeSent,
} from "@/types/api";

import type { LoginValues } from "./schemas";

export function login(values: LoginValues): Promise<SessionUser> {
  return api<SessionUser>("/auth/login", { method: "POST", body: values });
}

export type RegisterInput = Required<Omit<RegisterBody, "deviceToken">>;

export function register(values: RegisterInput): Promise<SessionUser> {
  return api<SessionUser>("/auth/register", { method: "POST", body: values });
}

export function requestResetCode(email: string, captcha: string): Promise<ForgotPasswordAccepted> {
  return api<ForgotPasswordAccepted>("/auth/forgot", {
    method: "POST",
    body: { email, captcha },
  });
}

export function resetPassword(input: ResetPasswordInput): Promise<SessionUser> {
  return api<SessionUser>("/auth/reset", { method: "POST", body: input });
}

export function answerKeepOrStartFresh(
  userId: string,
  answer: KeepOrStartFreshInput,
): Promise<User> {
  return api<User>(`/users/${encodeURIComponent(userId)}/keep-or-start-fresh`, {
    method: "POST",
    body: answer,
  });
}

export function confirmEmailWithCode(code: string): Promise<unknown> {
  return api("/auth/verify", { method: "POST", body: { code } });
}

export function confirmEmailWithLink(token: string): Promise<unknown> {
  return api("/auth/verify", { method: "POST", body: { token } });
}

export function sendVerificationCode(captcha: string): Promise<VerificationCodeSent> {
  return api<VerificationCodeSent>("/auth/resend", { method: "POST", body: { captcha } });
}

export function deleteAccountThatUsedMyEmail(token: string): Promise<unknown> {
  return api("/auth/not-me", { method: "POST", body: { token } });
}
