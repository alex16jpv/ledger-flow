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
  // The zone `lib/local/derive` buckets by comes from the profile row, which a pull refreshes.
  await pullAfterDirectSend();
  return answer;
}

export function deleteUser(id: string): Promise<unknown> {
  return api<unknown>(`/users/${id}`, { method: "DELETE" });
}

// F-43: through the repository like every other read, so the figures survive with no network.
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
