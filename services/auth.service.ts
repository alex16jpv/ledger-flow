import type { ProxyResponse } from "@/lib/api/proxy";
import type {
  LoginCredentials,
  RegisterPayload,
  User,
} from "@/types/Auth.types";
import { handleUserChange } from "@/lib/cache";

export async function login(
  credentials: LoginCredentials,
): Promise<ProxyResponse<User>> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const result: ProxyResponse<User> = await res.json();
  if (result.data) handleUserChange(result.data.id);
  return result;
}

export async function register(
  payload: RegisterPayload,
): Promise<ProxyResponse<User>> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function logout(): Promise<ProxyResponse<null>> {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
  });

  handleUserChange(null);
  return res.json();
}
