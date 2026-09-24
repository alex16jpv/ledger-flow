import { api } from "@/lib/api/client";
import { noteSessionStarted } from "@/lib/api/refresh";
import { pullAfterDirectSend } from "@/lib/local/outbox";
import { readAccounts, readCategoriesPage } from "@/lib/local/repository";
import type {
  AccountList,
  AuthTokens,
  DeleteUserInput,
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

export function deleteUser(id: string, input: DeleteUserInput): Promise<unknown> {
  return api<unknown>(`/users/${id}`, { method: "DELETE", body: input });
}

export interface CategorySummary {
  active: number;
  archived: number;
}

// F-43: through the repository like every other read, so the figures survive with no network.
// T-72: counted from the server's totals, because a page of a hundred cannot count past a hundred.
export async function fetchCategorySummary(): Promise<CategorySummary> {
  const [active, all] = await Promise.all([
    readCategoriesPage({ limit: 1 }),
    readCategoriesPage({ includeArchived: true, limit: 1 }),
  ]);
  return {
    active: active.pagination.total,
    archived: all.pagination.total - active.pagination.total,
  };
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
export async function reauthenticate(email: string, password: string): Promise<AuthTokens> {
  const tokens = await api<AuthTokens>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  noteSessionStarted();
  return tokens;
}
