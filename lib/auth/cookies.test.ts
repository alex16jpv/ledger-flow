import {
  expiredAuthCookies,
  expiredSessionCookies,
  parseSessionMarker,
  serializeCookie,
  sessionCookies,
  sessionMarkerCookie,
} from "./cookies";

describe("session cookies", () => {
  it("scopes the refresh cookie to the BFF and marks the session with a Lax cookie", () => {
    const [access, refresh, marker] = sessionCookies({ accessToken: "a", refreshToken: "r" }, "u1");
    expect(access).toMatchObject({
      name: "__Host-access",
      path: "/",
      sameSite: "strict",
      httpOnly: true,
      secure: true,
      maxAge: 900,
    });
    expect(refresh).toMatchObject({
      name: "__Secure-refresh",
      path: "/api/auth",
      sameSite: "strict",
      maxAge: 2_592_000,
    });
    expect(marker).toMatchObject({
      name: "__Host-session",
      path: "/",
      sameSite: "lax",
      // 400 days, and readable: it is what opens the vault when the session is long gone (§2.6).
      maxAge: 34_560_000,
      httpOnly: false,
    });
    expect(parseSessionMarker(marker?.value)?.userId).toBe("u1");
  });

  it("leaves the marker alone when the user is not known", () => {
    // A refresh answers tokens and no user: re-stamping the marker would cost the device its vault.
    expect(sessionCookies({ accessToken: "a", refreshToken: "r" })).toHaveLength(2);
  });

  it("parses a marker whose id contains dots", () => {
    const marker = sessionMarkerCookie("a.b.c", 1_000_000).value;
    expect(parseSessionMarker(marker)).toEqual({ userId: "a.b.c", issuedAt: 1_000_000 });
  });

  it("keeps the marker when only the session died", () => {
    const names = expiredAuthCookies().map((cookie) => cookie.name);
    expect(names).toEqual(["__Host-access", "__Secure-refresh"]);
    expect(names).not.toContain("__Host-session");
  });

  it("expires all three on logout", () => {
    for (const cookie of expiredSessionCookies()) {
      expect(cookie.maxAge).toBe(0);
      expect(cookie.value).toBe("");
    }
  });

  it("serializes with the prefix requirements", () => {
    const [access] = sessionCookies({ accessToken: "tok", refreshToken: "r" }, "u1");
    expect(serializeCookie(access!)).toBe(
      "__Host-access=tok; Path=/; Max-Age=900; SameSite=Strict; HttpOnly; Secure",
    );
  });
});
