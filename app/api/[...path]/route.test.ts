// @vitest-environment node
import { NextRequest } from "next/server";

import { DELETE, GET, POST } from "./route";

vi.mock("server-only", () => ({}));

const APP = "http://localhost:3001";
const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generic API proxy", () => {
  it("answers 401 without an access cookie and never calls the backend", async () => {
    const response = await GET(new NextRequest(`${APP}/api/accounts`), context("accounts"));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards method, query, body, Idempotency-Key and request id with the Bearer token", async () => {
    fetchMock.mockResolvedValue(
      json({ id: "t1" }, { status: 201, headers: { "x-request-id": "req-9" } }),
    );
    const request = new NextRequest(`${APP}/api/transactions/quick?source=QUICK`, {
      method: "POST",
      headers: {
        origin: APP,
        cookie: "__Host-access=tok",
        "content-type": "application/json",
        "Idempotency-Key": "key-1",
        "x-request-id": "req-9",
      },
      body: JSON.stringify({ amount: 12500 }),
    });
    const response = await POST(request, context("transactions", "quick"));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "t1" });
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("x-request-id")).toBe("req-9");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://backend.test/transactions/quick?source=QUICK");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ amount: 12500 }));
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer tok");
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(headers["x-request-id"]).toBe("req-9");
  });

  it("passes upstream errors through untouched, including Retry-After", async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: "x", message: "y", code: "INVALID_CURSOR" },
        { status: 400, headers: { "retry-after": "3" } },
      ),
    );
    const response = await GET(
      new NextRequest(`${APP}/api/transactions?cursor=zzz`, {
        headers: { cookie: "__Host-access=tok" },
      }),
      context("transactions"),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("retry-after")).toBe("3");
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_CURSOR" });
  });

  it("requires a trusted origin for mutations and blocks the session endpoints", async () => {
    const foreign = new NextRequest(`${APP}/api/accounts/a1`, {
      method: "DELETE",
      headers: { origin: "https://evil.example", cookie: "__Host-access=tok" },
    });
    expect((await DELETE(foreign, context("accounts", "a1"))).status).toBe(403);
    const blocked = new NextRequest(`${APP}/api/auth/refresh`, {
      method: "POST",
      headers: { origin: APP, cookie: "__Host-access=tok" },
    });
    expect((await POST(blocked, context("auth", "refresh"))).status).toBe(404);
    const sessions = new NextRequest(`${APP}/api/auth/sessions`, {
      headers: { cookie: "__Host-access=tok" },
    });
    fetchMock.mockResolvedValue(json({ data: [] }));
    expect((await GET(sessions, context("auth", "sessions"))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a backend timeout to 504 JSON", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    const response = await GET(
      new NextRequest(`${APP}/api/accounts`, { headers: { cookie: "__Host-access=tok" } }),
      context("accounts"),
    );
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ code: "DB_UNAVAILABLE" });
  });
});
