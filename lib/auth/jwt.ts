export interface AccessClaims {
  userId: string;
  email?: string;
  timezone?: string;
  exp?: number;
}

// Tokens are issued by our own backend and verified there; the BFF only reads the payload.
export function decodeAccessToken(token: string | null | undefined): AccessClaims | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const claims = JSON.parse(json) as Partial<AccessClaims>;
    return typeof claims.userId === "string" ? (claims as AccessClaims) : null;
  } catch {
    return null;
  }
}

export function isExpired(claims: AccessClaims | null, now = Date.now()): boolean {
  if (!claims?.exp) return false;
  return claims.exp * 1000 <= now;
}
