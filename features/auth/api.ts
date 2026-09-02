import { api } from "@/lib/api/client";
import type { SessionUser } from "@/lib/session/api";

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
