// @vitest-environment node
import { NextRequest } from "next/server";

import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { authenticate } from "@/lib/auth/handlers";

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
  return new Request(`${APP}${path}`, {
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
    // A dead refresh is not a logout: taking the marker or the storage would take the vault with
    // it, and the app is supposed to keep working locally (§2.6, invariant 7).
    expect(cookies.some((c) => c.startsWith("__Host-session="))).toBe(false);
    expect(cookies.filter((c) => /Max-Age=0/i.test(c))).toHaveLength(2);
    expect(response.headers.get("clear-site-data")).toBeNull();
  });

  it("answers 401 without a refresh cookie", async () => {
    const request = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP },
    });
    const response = await refresh(request);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
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
    // Only the app shell: whether the unsent queue goes is the user's answer to the sheet of
    // F-34, and `purgeVault` applies it. `"storage"` here would decide it for them.
    expect(response.headers.get("clear-site-data")).toBe('"cache"');
    const cookies = setCookies(response);
    expect(cookies.filter((c) => /Max-Age=0/i.test(c))).toHaveLength(3);
  });
});
