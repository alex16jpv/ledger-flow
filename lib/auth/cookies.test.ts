import { expiredSessionCookies, serializeCookie, sessionCookies } from "./cookies";

describe("session cookies", () => {
  it("scopes the refresh cookie to the BFF and marks the session with a Lax cookie", () => {
    const [access, refresh, marker] = sessionCookies({ accessToken: "a", refreshToken: "r" });
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
      value: "1",
    });
  });

  it("expires all three on logout", () => {
    for (const cookie of expiredSessionCookies()) {
      expect(cookie.maxAge).toBe(0);
      expect(cookie.value).toBe("");
    }
  });

  it("serializes with the prefix requirements", () => {
    const [access] = sessionCookies({ accessToken: "tok", refreshToken: "r" });
    expect(serializeCookie(access!)).toBe(
      "__Host-access=tok; Path=/; Max-Age=900; SameSite=Strict; HttpOnly; Secure",
    );
  });
});
