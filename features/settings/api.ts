import { api } from "@/lib/api/client";
import type { CategoryList, Session, UpdateUserInput, User } from "@/types/api";

export function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return api<User>(`/users/${id}`, { method: "PUT", body: input });
}

export function fetchCategorySummary(): Promise<CategoryList> {
  return api<CategoryList>("/categories", { query: { includeArchived: "true", limit: 100 } });
}

export function fetchSessions(): Promise<{ data: Session[] }> {
  return api<{ data: Session[] }>("/auth/sessions");
}
