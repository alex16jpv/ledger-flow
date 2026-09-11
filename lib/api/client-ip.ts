import "server-only";

import { isIP } from "node:net";

export const CLIENT_IP_HEADER = "x-client-ip";

// x-real-ip first: the platform writes one address there, while a forwarded list can start with a value the client chose.
export function clientIpOf(request: Request): string | null {
  const real = request.headers.get("x-real-ip");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  const candidate = (real ?? forwarded ?? "").trim();
  return isIP(candidate) ? candidate : null;
}
