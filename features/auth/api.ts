import { api } from "@/lib/api/client";
import type { SessionUser } from "@/lib/session/api";

import type { LoginValues } from "./schemas";

export function login(values: LoginValues): Promise<SessionUser> {
  return api<SessionUser>("/auth/login", { method: "POST", body: values });
}
