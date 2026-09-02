export function isTrustedOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin") ?? refererOrigin(request.headers.get("referer"));
  if (!origin) return false;
  const allowed = new Set([new URL(appUrl).origin]);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);
  return allowed.has(origin);
}

function refererOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
