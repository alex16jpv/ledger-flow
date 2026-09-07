import { api } from "@/lib/api/client";
import type { User } from "@/types/api";

export interface SessionUser {
  user: User;
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
