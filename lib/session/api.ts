import { api } from "@/lib/api/client";
import type { User, UserWithEmailVerification } from "@/types/api";

export type SessionProfile = User & Partial<Pick<UserWithEmailVerification, "emailVerification">>;

export interface SessionUser {
  user: SessionProfile;
}

export function fetchCurrentUser(): Promise<SessionUser> {
  return api<SessionUser>("/auth/me");
}

export function requestLogout(): Promise<unknown> {
  return api("/auth/logout", { method: "POST" });
}

export function requestLogoutAll(): Promise<unknown> {
  return api("/auth/logout-all", { method: "POST" });
}
