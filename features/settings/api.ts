import { api } from "@/lib/api/client";
import { pullAfterDirectSend } from "@/lib/local/outbox";
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

export function fetchCategorySummary(): Promise<CategoryList> {
  return api<CategoryList>("/categories", { query: { includeArchived: "true", limit: 100 } });
}

export function fetchAccountCount(): Promise<AccountList> {
  return api<AccountList>("/accounts", { query: { limit: 1 } });
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
