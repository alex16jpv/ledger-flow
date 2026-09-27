import { api } from "@/lib/api/client";
import type { SessionUser } from "@/lib/session/api";
import type {
  ForgotPasswordAccepted,
  KeepOrStartFreshInput,
  ResetPasswordInput,
  User,
} from "@/types/api";

import type { LoginValues } from "./schemas";

export function login(values: LoginValues): Promise<SessionUser> {
  return api<SessionUser>("/auth/login", { method: "POST", body: values });
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  currency: string;
  timezone: string;
  locale: "en" | "es";
}

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
