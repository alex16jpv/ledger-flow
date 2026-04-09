import type { ProxyResponse } from "@/lib/api/proxy";
import type {
  LoginCredentials,
  RegisterPayload,
  User,
} from "@/types/Auth.types";
import { handleUserChange } from "@/lib/cache";
import { safeFetch } from "@/lib/api/safeFetch";

export async function login(
  credentials: LoginCredentials,
): Promise<ProxyResponse<User>> {
  const result = await safeFetch<User>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (result.data) handleUserChange(result.data.id);
  return result;
}

export async function register(
  payload: RegisterPayload,
): Promise<ProxyResponse<User>> {
  return safeFetch<User>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<ProxyResponse<null>> {
  const result = await safeFetch<null>("/api/auth/logout", {
    method: "POST",
  });

  handleUserChange(null);
  return result;
}
