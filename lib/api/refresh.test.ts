import { tabChannel } from "@/lib/session/channel";

import { api, setUnauthorizedHandler } from "./client";
import { noteRefreshedElsewhere, refreshSession, resetRefreshState } from "./refresh";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

const fetchMock = vi.fn<typeof fetch>();
const urlOf = (input: string | URL | Request) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  resetRefreshState();
  tabChannel.reset();
  setUnauthorizedHandler((_error, context) => refreshSession({ since: context.startedAt }));
});

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe("refresh single-flight", () => {
  it("turns five concurrent 401s into exactly one refresh and retries all of them", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = urlOf(input);
      if (url.endsWith("/api/auth/refresh")) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return json({});
      }
      const refreshed = fetchMock.mock.calls.some(([target]) =>
        urlOf(target).endsWith("/api/auth/refresh"),
      );
      return refreshed
        ? json({ ok: url })
        : json({ error: "Unauthorized", message: "expired" }, { status: 401 });
    });

    const results = await Promise.all(
      ["/accounts", "/categories", "/budgets", "/transactions", "/stats/spending"].map((path) =>
        api<{ ok: string }>(path),
      ),
    );
    expect(results.map((result) => result.ok)).toHaveLength(5);
    const refreshCalls = fetchMock.mock.calls.filter(([target]) =>
      urlOf(target).endsWith("/api/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("skips the refresh when another tab already rotated the token after this request started", async () => {
    fetchMock.mockResolvedValue(json({}));
    noteRefreshedElsewhere(Date.now() + 1000);
    await expect(refreshSession({ since: Date.now() })).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("announces the expired session locally and to other tabs on REFRESH_REVOKED", async () => {
    const received: string[] = [];
    tabChannel.subscribe((message) => {
      received.push(message.type);
    });
    fetchMock.mockResolvedValue(
      json({ error: "Unauthorized", message: "x", code: "REFRESH_REVOKED" }, { status: 401 }),
    );
    await expect(refreshSession()).resolves.toBe(false);
    expect(received).toContain("session:expired");
  });

  it("uses the Web Lock when the browser offers one", async () => {
    const request = vi.fn(async (_name: string, callback: () => Promise<boolean>) => callback());
    Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
    fetchMock.mockResolvedValue(json({}));
    await expect(refreshSession()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith("lf-refresh", expect.any(Function));
    Reflect.deleteProperty(navigator, "locks");
  });
});
