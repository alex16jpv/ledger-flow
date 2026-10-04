// @vitest-environment node
import { NextRequest } from "next/server";

import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import {
  authenticate,
  cancelEmailChange,
  confirmEmail,
  confirmEmailChange,
  confirmSignUp,
  forgetSignUp,
  pendingSignUp,
  requestEmailChange,
  requestPasswordReset,
  resendSignUp,
  startSignUp,
} from "@/lib/auth/handlers";
import { SESSION_END_HEADER } from "@/lib/auth/session-end";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn<typeof fetch>();
const APP = "http://localhost:3001";
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

const tokens = { accessToken: "acc", refreshToken: "ref", user: { id: "u1", locale: "es" } };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${APP}${path}`, {
    method: "POST",
    headers: {
      origin: APP,
      "content-type": "application/json",
      "x-request-id": "req-1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const setCookies = (response: Response) => response.headers.getSetCookie();

describe("login handler", () => {
  it("rejects requests from another origin before touching the backend", async () => {
    const response = await authenticate(
      "/auth/login",
      post("/api/auth/login", {}, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the token pair in cookies and returns only the user", async () => {
    fetchMock.mockResolvedValue(json(tokens, { status: 200 }));
    const response = await authenticate(
      "/auth/login",
      post("/api/auth/login", { email: "a@b.co", password: "x" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: tokens.user });
    const cookies = setCookies(response);
    expect(
      cookies.some(
        (c) => c.startsWith("__Host-access=acc") && /HttpOnly/i.test(c) && /Secure/i.test(c),
      ),
    ).toBe(true);
    expect(
      cookies.some((c) => c.startsWith("__Secure-refresh=ref") && /Path=\/api\/auth/i.test(c)),
    ).toBe(true);
    // The marker carries the user id and outlives the refresh token: §2.6 local mode reads it.
    expect(
      cookies.some(
        (c) =>
          c.startsWith(`__Host-session=${tokens.user.id}.`) &&
          /SameSite=lax/i.test(c) &&
          /Max-Age=34560000/i.test(c) &&
          !/HttpOnly/i.test(c),
      ),
    ).toBe(true);
    expect(cookies.some((c) => c.startsWith("lf_locale=es"))).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/auth/login");
    expect((init?.headers as Record<string, string>)["x-request-id"]).toBe("req-1");
  });

  it("tells the backend which client is logging in, not just that the frontend called", async () => {
    fetchMock.mockResolvedValue(json(tokens, { status: 200 }));
    await authenticate(
      "/auth/login",
      post("/api/auth/login", { email: "a@b.co", password: "x" }, { "x-real-ip": "203.0.113.7" }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["x-client-ip"]).toBe("203.0.113.7");
  });

  it("does not let the browser pick the address its login attempts count against", async () => {
    fetchMock.mockResolvedValue(json(tokens, { status: 200 }));
    await authenticate(
      "/auth/login",
      post("/api/auth/login", { email: "a@b.co", password: "x" }, { "x-client-ip": "203.0.113.7" }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["x-client-ip"]).toBeUndefined();
  });

  it("keeps the device token the backend answers in its own long-lived cookie", async () => {
    fetchMock.mockResolvedValue(json({ ...tokens, deviceToken: "dev1" }, { status: 200 }));
    const response = await authenticate(
      "/auth/login",
      post("/api/auth/login", { email: "a@b.co", password: "x" }),
    );
    await expect(response.json()).resolves.toEqual({ user: tokens.user });
    expect(
      setCookies(response).some(
        (c) =>
          c.startsWith("__Secure-device=dev1") &&
          /Path=\/api\/auth/i.test(c) &&
          /Max-Age=31536000/i.test(c) &&
          /HttpOnly/i.test(c) &&
          /Secure/i.test(c) &&
          /SameSite=strict/i.test(c),
      ),
    ).toBe(true);
  });

  it.each(["/auth/login", "/auth/login/restore"] as const)(
    "sends %s the device cookie, never a device token the browser wrote",
    async (path) => {
      fetchMock.mockResolvedValue(json(tokens, { status: 200 }));
      await authenticate(
        path,
        post(
          `/api${path}`,
          { email: "a@b.co", password: "x", deviceToken: "forged" },
          { cookie: "__Secure-device=dev1" },
        ),
      );
      expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
        email: "a@b.co",
        password: "x",
        deviceToken: "dev1",
      });
    },
  );

  it("drops a device token the browser wrote when the device has no cookie", async () => {
    fetchMock.mockResolvedValue(json(tokens, { status: 200 }));
    await authenticate(
      "/auth/login",
      post("/api/auth/login", { email: "a@b.co", password: "x", deviceToken: "forged" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      email: "a@b.co",
      password: "x",
    });
  });

  it("passes backend errors through with their code and Retry-After", async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: "TooMany", message: "slow", code: "RATE_LIMITED" },
        { status: 429, headers: { "retry-after": "60" } },
      ),
    );
    const response = await authenticate("/auth/login", post("/api/auth/login", {}));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({ code: "RATE_LIMITED" });
    expect(setCookies(response)).toHaveLength(0);
  });
});

describe("forgot-password handler", () => {
  it("sends the device cookie with the captcha and answers the backend's 202 as it came", async () => {
    fetchMock.mockResolvedValue(json({ resendAfterSeconds: 60 }, { status: 202 }));
    const response = await requestPasswordReset(
      post(
        "/api/auth/forgot",
        { email: "a@b.co", captcha: "tok", deviceToken: "forged" },
        { cookie: "__Secure-device=dev1" },
      ),
    );
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ resendAfterSeconds: 60 });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/auth/password/forgot");
    expect(JSON.parse(init?.body as string)).toEqual({
      email: "a@b.co",
      captcha: "tok",
      deviceToken: "dev1",
    });
    expect(setCookies(response)).toHaveLength(0);
  });

  it("drops a device token the browser wrote when the device has no cookie", async () => {
    fetchMock.mockResolvedValue(json({ resendAfterSeconds: 60 }, { status: 202 }));
    await requestPasswordReset(
      post("/api/auth/forgot", { email: "a@b.co", captcha: "tok", deviceToken: "forged" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      email: "a@b.co",
      captcha: "tok",
    });
  });

  it("answers 502, not an empty 202, when the backend's answer cannot be read", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 202 }));
    const response = await requestPasswordReset(post("/api/auth/forgot", { email: "a@b.co" }));
    expect(response.status).toBe(502);
  });

  it("rejects another origin before spending the captcha", async () => {
    const response = await requestPasswordReset(
      post("/api/auth/forgot", { email: "a@b.co" }, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the captcha refusal and the limits through with their code", async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: "TooMany", message: "slow", code: "RATE_LIMITED" },
        { status: 429, headers: { "retry-after": "240" } },
      ),
    );
    const response = await requestPasswordReset(post("/api/auth/forgot", { email: "a@b.co" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("240");
    await expect(response.json()).resolves.toMatchObject({ code: "RATE_LIMITED" });
  });
});

const ACCESS_FOR_U1 = `h.${Buffer.from(JSON.stringify({ userId: "u1" })).toString("base64url")}.s`;

describe("email change handlers", () => {
  it("asks for the change on the session's own account, with this device's cookie", async () => {
    fetchMock.mockResolvedValue(json({ resendAfterSeconds: 60, emailChange: {} }, { status: 202 }));
    const response = await requestEmailChange(
      "request",
      post(
        "/api/auth/change-email",
        { email: "new@b.co", currentPassword: "x", captcha: "tok", deviceToken: "forged" },
        { cookie: `__Host-access=${ACCESS_FOR_U1}; __Secure-device=dev1` },
      ),
    );
    expect(response.status).toBe(202);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/users/u1/email-change");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${ACCESS_FOR_U1}`);
    expect(JSON.parse(init?.body as string)).toEqual({
      email: "new@b.co",
      currentPassword: "x",
      captcha: "tok",
      deviceToken: "dev1",
    });
  });

  it("sends Resend to its own path, and answers 401 with no session before touching the backend", async () => {
    fetchMock.mockResolvedValue(json({ resendAfterSeconds: 60, emailChange: {} }, { status: 202 }));
    await requestEmailChange(
      "resend",
      post(
        "/api/auth/change-email/resend",
        { captcha: "tok" },
        { cookie: `__Host-access=${ACCESS_FOR_U1}` },
      ),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://backend.test/users/u1/email-change/resend");
    fetchMock.mockClear();
    const anonymous = await requestEmailChange(
      "resend",
      post("/api/auth/change-email/resend", { captcha: "tok" }),
    );
    expect(anonymous.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels with a DELETE on the session's account, from a trusted origin only", async () => {
    fetchMock.mockResolvedValue(json({ message: "Nothing waits" }));
    const request = (origin: string) =>
      new NextRequest(`${APP}/api/auth/change-email`, {
        method: "DELETE",
        headers: { origin, cookie: `__Host-access=${ACCESS_FOR_U1}` },
      });
    expect((await cancelEmailChange(request("https://evil.example"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    const response = await cancelEmailChange(request(APP));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/users/u1/email-change");
    expect(init?.method).toBe("DELETE");
  });

  it("stores the new session a code answers, and returns only the user", async () => {
    fetchMock.mockResolvedValue(json({ ...tokens, deviceToken: "dev2" }));
    const response = await confirmEmailChange(
      post("/api/auth/confirm-change", { code: "482719" }, { cookie: "__Host-access=acc" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: tokens.user });
    const cookies = setCookies(response).join("\n");
    expect(cookies).toContain("__Host-access=acc");
    expect(cookies).toContain("__Secure-refresh=ref");
    expect(cookies).toContain("__Secure-device=dev2");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/auth/email/confirm-change");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer acc");
    expect(JSON.parse(init?.body as string)).toEqual({ code: "482719" });
  });

  it("sends a link with this browser's refresh cookie, never one the body names", async () => {
    fetchMock.mockResolvedValue(json({ user: tokens.user }));
    const response = await confirmEmailChange(
      post(
        "/api/auth/confirm-change",
        { token: "t".repeat(64), refreshToken: "forged" },
        { cookie: "__Secure-refresh=mine" },
      ),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      token: "t".repeat(64),
      refreshToken: "mine",
    });
    await expect(response.json()).resolves.toEqual({});
    expect(setCookies(response)).toEqual([]);
  });

  it("keeps this browser's session when the link answers one: cookies set, only the user returned", async () => {
    fetchMock.mockResolvedValue(json({ ...tokens, deviceToken: "dev3" }));
    const response = await confirmEmailChange(
      post(
        "/api/auth/confirm-change",
        { token: "t".repeat(64) },
        { cookie: "__Secure-refresh=mine" },
      ),
    );
    await expect(response.json()).resolves.toEqual({ user: tokens.user });
    const cookies = setCookies(response).join("\n");
    expect(cookies).toContain("__Secure-refresh=ref");
    expect(cookies).toContain("__Secure-device=dev3");
  });

  it("sends a link with no refresh token when this browser has none", async () => {
    fetchMock.mockResolvedValue(json({ user: tokens.user }));
    await confirmEmailChange(post("/api/auth/confirm-change", { token: "t".repeat(64) }));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      token: "t".repeat(64),
    });
  });

  it("passes the backend's refusals through with their code", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Conflict", message: "taken", code: "EMAIL_TAKEN" }, { status: 409 }),
    );
    const response = await confirmEmailChange(
      post("/api/auth/confirm-change", { code: "482719" }, { cookie: "__Host-access=acc" }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(setCookies(response)).toEqual([]);
  });
});

describe("email confirmation handlers", () => {
  it("sends a code with the session, and answers the backend's 200 as it came", async () => {
    fetchMock.mockResolvedValue(json({ message: "Email confirmed" }));
    const response = await confirmEmail(
      "/auth/email/verify",
      post("/api/auth/verify", { code: "482719" }, { cookie: "__Host-access=acc" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Email confirmed" });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/auth/email/verify");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer acc");
    expect(JSON.parse(init?.body as string)).toEqual({ code: "482719" });
  });

  it("adds this device's cookie to Resend, and passes the limits through", async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: "TooMany", message: "slow", code: "RATE_LIMITED" },
        { status: 429, headers: { "retry-after": "60" } },
      ),
    );
    const response = await confirmEmail(
      "/auth/email/resend",
      post(
        "/api/auth/resend",
        { captcha: "tok", deviceToken: "forged" },
        { cookie: "__Host-access=acc; __Secure-device=dev1" },
      ),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/auth/email/resend");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer acc");
    expect(JSON.parse(init?.body as string)).toEqual({ captcha: "tok", deviceToken: "dev1" });
  });

  it("sends a restore link without any session, whatever this browser holds", async () => {
    fetchMock.mockResolvedValue(json({ email: "a@b.co", codeSent: true }));
    const response = await confirmEmail(
      "/auth/email/restore",
      post("/api/auth/restore", { token: "t".repeat(64) }, { cookie: "__Host-access=acc" }),
    );
    await expect(response.json()).resolves.toEqual({ email: "a@b.co", codeSent: true });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/auth/email/restore");
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
  });

  it("rejects another origin before touching the backend", async () => {
    const response = await confirmEmail(
      "/auth/email/verify",
      post("/api/auth/verify", { token: "t" }, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 DB_UNAVAILABLE, like every other route, when the backend cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    for (const response of [
      await confirmEmail("/auth/email/verify", post("/api/auth/verify", { token: "t" })),
      await requestPasswordReset(post("/api/auth/forgot", { email: "a@b.co" })),
      await authenticate("/auth/login", post("/api/auth/login", { email: "a@b.co" })),
    ]) {
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: "DB_UNAVAILABLE" });
    }
  });
});

describe("reset-password handler", () => {
  it("answers a session like a login, keeping the new device token", async () => {
    fetchMock.mockResolvedValue(json({ ...tokens, deviceToken: "dev2" }, { status: 200 }));
    const response = await authenticate(
      "/auth/password/reset",
      post("/api/auth/reset", { token: "t".repeat(43), newPassword: "LedgerFlow!2027" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: tokens.user });
    const cookies = setCookies(response);
    expect(cookies.some((c) => c.startsWith("__Host-access=acc"))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`__Host-session=${tokens.user.id}.`))).toBe(true);
    expect(cookies.some((c) => c.startsWith("__Secure-device=dev2"))).toBe(true);
  });

  it("says when the new password brought a deleted account back", async () => {
    fetchMock.mockResolvedValue(json({ ...tokens, restored: true }, { status: 200 }));
    const response = await authenticate(
      "/auth/password/reset",
      post("/api/auth/reset", { token: "t".repeat(43), newPassword: "LedgerFlow!2027" }),
    );
    await expect(response.json()).resolves.toEqual({ user: tokens.user, restored: true });
  });

  it("does not add the device token to a body the backend reads strictly", async () => {
    fetchMock.mockResolvedValue(json(tokens, { status: 200 }));
    await authenticate(
      "/auth/password/reset",
      post(
        "/api/auth/reset",
        { email: "a@b.co", code: "123456", newPassword: "LedgerFlow!2027" },
        { cookie: "__Secure-device=dev1" },
      ),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      email: "a@b.co",
      code: "123456",
      newPassword: "LedgerFlow!2027",
    });
  });
});

describe("sign-up handlers", () => {
  const started = {
    signUpToken: "s".repeat(43),
    expiresAt: "2099-01-02T00:00:00.000Z",
    resendAfterSeconds: 60,
  };
  const signUpCookieOf = (response: Response) =>
    setCookies(response).find((c) => c.startsWith("__Secure-sign-up="));
  const cookieValue = (cookie: string | undefined) => cookie?.split(";")[0]?.split("=")[1] ?? "";
  const body = {
    name: "Ana",
    email: " Ana@Example.co ",
    password: "LedgerFlow!2026",
    currency: "COP",
    timezone: "America/Bogota",
    locale: "es",
    captcha: "tok",
  };

  async function startedCookie(): Promise<string> {
    fetchMock.mockResolvedValueOnce(json(started, { status: 202 }));
    const response = await startSignUp(post("/api/auth/sign-up", body));
    return `__Secure-sign-up=${cookieValue(signUpCookieOf(response))}`;
  }

  it("keeps the sign-up's token in this browser's cookie and never gives it to the page", async () => {
    fetchMock.mockResolvedValue(json(started, { status: 202 }));
    const response = await startSignUp(
      post(
        "/api/auth/sign-up",
        { ...body, deviceToken: "forged" },
        { cookie: "__Secure-device=d1" },
      ),
    );
    expect(response.status).toBe(202);
    const answer = (await response.json()) as Record<string, unknown>;
    expect(answer).toMatchObject({ email: "ana@example.co", expiresAt: started.expiresAt });
    expect(answer.resendAfterSeconds).toBeGreaterThanOrEqual(59);
    expect(JSON.stringify(answer)).not.toContain(started.signUpToken);
    const cookie = signUpCookieOf(response);
    expect(cookie).toMatch(/Path=\/api\/auth\/sign-up/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/auth/sign-up");
    expect(JSON.parse(init?.body as string)).toEqual({ ...body, deviceToken: "d1" });
  });

  it("reads back what this browser is waiting for after a reload, and nothing once forgotten", async () => {
    const cookie = await startedCookie();
    const pending = pendingSignUp(
      new NextRequest(`${APP}/api/auth/sign-up`, { headers: { cookie } }),
    );
    await expect(pending.json()).resolves.toMatchObject({ email: "ana@example.co" });
    const none = pendingSignUp(new NextRequest(`${APP}/api/auth/sign-up`));
    expect(none.status).toBe(204);
    const forgotten = forgetSignUp(
      new NextRequest(`${APP}/api/auth/sign-up`, {
        method: "DELETE",
        headers: { origin: APP, cookie },
      }),
    );
    expect(signUpCookieOf(forgotten)).toMatch(/Max-Age=0/i);
  });

  it("confirms with the cookie's token, signs in, and forgets the sign-up", async () => {
    const cookie = await startedCookie();
    fetchMock.mockResolvedValueOnce(json({ ...tokens, deviceToken: "dev3" }, { status: 201 }));
    const response = await confirmSignUp(
      post("/api/auth/sign-up/confirm", { code: "482719" }, { cookie }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ user: tokens.user });
    const [url, init] = fetchMock.mock.calls[1] ?? [];
    expect(url).toBe("http://backend.test/auth/sign-up/confirm");
    expect(JSON.parse(init?.body as string)).toEqual({
      code: "482719",
      signUpToken: started.signUpToken,
    });
    const cookies = setCookies(response);
    expect(cookies.some((c) => c.startsWith("__Host-access=acc"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("__Secure-device=dev3"))).toBe(true);
    expect(signUpCookieOf(response)).toMatch(/Max-Age=0/i);
  });

  it("answers a code with no sign-up in this browser like any bad code, without asking", async () => {
    const response = await confirmSignUp(post("/api/auth/sign-up/confirm", { code: "482719" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "SIGN_UP_CODE_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forgets a sign-up the server says is over when Resend meets it", async () => {
    const cookie = await startedCookie();
    fetchMock.mockResolvedValueOnce(
      json({ error: "Conflict", message: "over", code: "SIGN_UP_EXPIRED" }, { status: 409 }),
    );
    const response = await resendSignUp(
      post("/api/auth/sign-up/resend", { captcha: "tok" }, { cookie }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "SIGN_UP_EXPIRED" });
    expect(signUpCookieOf(response)).toMatch(/Max-Age=0/i);
    const [, init] = fetchMock.mock.calls[1] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      captcha: "tok",
      signUpToken: started.signUpToken,
    });
  });

  it("moves the countdown on a Resend the server took", async () => {
    const cookie = await startedCookie();
    fetchMock.mockResolvedValueOnce(json({ resendAfterSeconds: 120 }, { status: 202 }));
    const response = await resendSignUp(
      post("/api/auth/sign-up/resend", { captcha: "tok" }, { cookie }),
    );
    const answer = (await response.json()) as { resendAfterSeconds: number };
    expect(answer.resendAfterSeconds).toBeGreaterThanOrEqual(119);
    expect(signUpCookieOf(response)).toMatch(/Max-Age=\d+/i);
  });

  it("says the sign-up is over when the browser holds none", async () => {
    const response = await resendSignUp(post("/api/auth/sign-up/resend", { captcha: "tok" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "SIGN_UP_EXPIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("refresh handler", () => {
  it("rotates the pair from the refresh cookie", async () => {
    fetchMock.mockResolvedValue(json({ accessToken: "acc2", refreshToken: "ref2" }));
    const request = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP, cookie: "__Secure-refresh=ref" },
    });
    const response = await refresh(request);
    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      refreshToken: "ref",
    });
    expect(setCookies(response).some((c) => c.startsWith("__Secure-refresh=ref2"))).toBe(true);
  });

  it("clears the tokens but keeps the marker when the backend revokes the session", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Unauthorized", message: "x", code: "REFRESH_REVOKED" }, { status: 401 }),
    );
    const request = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP, cookie: "__Secure-refresh=old" },
    });
    const response = await refresh(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "REFRESH_REVOKED" });
    const cookies = setCookies(response);
    // §2.6, invariant 7: a dead refresh is not a logout — taking the marker takes the vault.
    expect(cookies.some((c) => c.startsWith("__Host-session="))).toBe(false);
    expect(cookies.filter((c) => /Max-Age=0/i.test(c))).toHaveLength(2);
    expect(response.headers.get("clear-site-data")).toBeNull();
    expect(response.headers.get(SESSION_END_HEADER)).toBe("backend");
  });

  it("keeps the cookies when the 401 is not the session's [H-10]", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>gateway</html>", {
        status: 401,
        headers: { "content-type": "text/html" },
      }),
    );
    const request = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP, cookie: "__Secure-refresh=alive" },
    });
    const response = await refresh(request);
    expect(response.status).toBe(401);
    // Nobody said this token is over, so the way back is not taken away (H-10).
    expect(setCookies(response)).toHaveLength(0);
    expect(response.headers.get(SESSION_END_HEADER)).toBeNull();
  });

  it("re-marks the device when the renewed session belongs to someone the marker does not name", async () => {
    const access = (userId: string) =>
      `h.${Buffer.from(JSON.stringify({ userId })).toString("base64url")}.s`;
    fetchMock.mockResolvedValue(json({ accessToken: access("ada"), refreshToken: "ref2" }));
    const request = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP, cookie: "__Secure-refresh=ref; __Host-session=grace.1758000000" },
    });

    const response = await refresh(request);

    expect(setCookies(response).some((c) => c.startsWith("__Host-session=ada."))).toBe(true);
  });

  it("leaves the marker alone when the renewed session is the one it names", async () => {
    const access = `h.${Buffer.from(JSON.stringify({ userId: "ada" })).toString("base64url")}.s`;
    fetchMock.mockResolvedValue(json({ accessToken: access, refreshToken: "ref2" }));
    const request = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP, cookie: "__Secure-refresh=ref; __Host-session=ada.1758000000" },
    });

    const response = await refresh(request);

    expect(setCookies(response).some((c) => c.startsWith("__Host-session="))).toBe(false);
  });

  it("answers 401 without a refresh cookie", async () => {
    const request = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP },
    });
    const response = await refresh(request);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    // Its own answer, and it says so: the client must not read it as the backend's verdict (H-10).
    expect(response.headers.get(SESSION_END_HEADER)).toBe("no-cookie");
  });
});

describe("logout handler", () => {
  it("revokes the device session and clears cookies with Clear-Site-Data", async () => {
    fetchMock.mockResolvedValue(json({ message: "ok" }));
    const request = new NextRequest(`${APP}/api/auth/logout`, {
      method: "POST",
      headers: { origin: APP, cookie: "__Secure-refresh=ref; __Host-access=acc" },
    });
    const response = await logout(request);
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://backend.test/auth/logout");
    // F-34: only the app shell — whether the unsent queue goes is the user's answer, not ours.
    expect(response.headers.get("clear-site-data")).toBe('"cache"');
    const cookies = setCookies(response);
    expect(cookies.filter((c) => /Max-Age=0/i.test(c))).toHaveLength(3);
    expect(cookies.some((c) => c.startsWith("__Secure-device="))).toBe(false);
  });
});
