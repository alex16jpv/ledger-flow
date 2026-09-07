import { api } from "@/lib/api/client";
import { pullAfterDirectSend } from "@/lib/local/outbox";
import { readAccounts, readCategoriesPage } from "@/lib/local/repository";
import type {
  AccountList,
  AuthTokens,
  CategoryList,
  Session,
  UpdateUserInput,
  User,
} from "@/types/api";

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const answer = await api<User>(`/users/${id}`, { method: "PUT", body: input });
  // The profile row lives in the mirror too, and the zone `lib/local/derive` buckets by comes from
  // it: without a pull the figures would keep being cut on the old day boundary.
  await pullAfterDirectSend();
  return answer;
}

export function deleteUser(id: string): Promise<unknown> {
  return api<unknown>(`/users/${id}`, { method: "DELETE" });
}

// Through the repository, like every other read: these were the last two screens in `(app)` still
// asking the server, so Settings cost two requests with a full mirror and its two figures were the
// only ones that went blank with no network (F-43).
export function fetchCategorySummary(): Promise<CategoryList> {
  return readCategoriesPage({ includeArchived: true, limit: 100 });
}

export function fetchAccountCount(): Promise<AccountList> {
  return readAccounts({ limit: 1 });
}

export function fetchSessions(): Promise<{ data: Session[] }> {
  return api<{ data: Session[] }>("/auth/sessions");
}

export function revokeSession(id: string): Promise<unknown> {
  return api<unknown>(`/auth/sessions/${id}`, { method: "DELETE" });
}

// A credential change revokes every refresh token, this device's included: sign in again with the new pair.
export function reauthenticate(email: string, password: string): Promise<AuthTokens> {
  return api<AuthTokens>("/auth/login", { method: "POST", body: { email, password } });
}
