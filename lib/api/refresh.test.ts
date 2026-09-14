import { SESSION_END_HEADER } from "@/lib/auth/session-end";
import { reportError } from "@/lib/observability/reporter";
import { tabChannel } from "@/lib/session/channel";

import { api, setUnauthorizedHandler } from "./client";
import { NetworkError } from "./errors";
import {
  noteRefreshedElsewhere,
  noteSessionEnded,
  noteSessionStarted,
  refreshSession,
  resetRefreshState,
} from "./refresh";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

vi.mock("@/lib/observability/reporter", () => ({ reportError: vi.fn() }));

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

function listen(): string[] {
  const received: string[] = [];
  tabChannel.subscribe((message) => {
    received.push(message.type);
  });
  return received;
}

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
    const received = listen();
    fetchMock.mockResolvedValue(
      json(
        { error: "Unauthorized", message: "x", code: "REFRESH_REVOKED" },
        { status: 401, headers: { [SESSION_END_HEADER]: "backend" } },
      ),
    );
    await expect(refreshSession()).resolves.toBe(false);
    expect(received).toContain("session:expired");
  });

  it("ends the session when the BFF says no refresh cookie arrived [H-10]", async () => {
    const received = listen();
    fetchMock.mockResolvedValue(
      json(
        { error: "Unauthorized", message: "No session", code: "REFRESH_INVALID" },
        { status: 401, headers: { [SESSION_END_HEADER]: "no-cookie" } },
      ),
    );
    await expect(refreshSession()).resolves.toBe(false);
    expect(received).toContain("session:expired");
  });

  it("asks once and reports once: a session the backend ended is not asked for again [H-61]", async () => {
    vi.mocked(reportError).mockClear();
    fetchMock.mockResolvedValue(
      json(
        { error: "Unauthorized", message: "x", code: "REFRESH_REVOKED" },
        { status: 401, headers: { [SESSION_END_HEADER]: "backend" } },
      ),
    );
    await expect(refreshSession()).resolves.toBe(false);
    await expect(refreshSession()).resolves.toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it("drops a refresh that was waiting for the lock when another tab signs out [H-61]", async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("navigator", {
      locks: {
        request: async (_name: string, run: () => Promise<boolean>) => {
          await held;
          return run();
        },
      },
    });
    fetchMock.mockResolvedValue(json({}));

    const waiting = refreshSession();
    noteSessionEnded();
    release?.();

    await expect(waiting).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not ask for a token after the user signs out [H-61]", async () => {
    fetchMock.mockResolvedValue(json({}));
    noteSessionEnded();
    await expect(refreshSession()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks again once somebody signs in [H-61]", async () => {
    fetchMock.mockResolvedValue(json({}));
    noteSessionEnded();
    noteSessionStarted();
    await expect(refreshSession()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again when another tab brings the session back [H-61]", async () => {
    fetchMock.mockResolvedValue(json({}));
    noteSessionEnded();
    noteRefreshedElsewhere(Date.now() - 1000);
    await expect(refreshSession()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the session on a 401 nobody signed, and asks once more [H-10]", async () => {
    const received = listen();
    fetchMock.mockResolvedValue(json({ error: "Unauthorized", message: "x" }, { status: 401 }));
    await expect(refreshSession()).resolves.toBe(false);
    expect(received).not.toContain("session:expired");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the session when the answer is not the session's to give [H-10]", async () => {
    const received = listen();
    fetchMock.mockResolvedValue(json({ error: "Bad gateway" }, { status: 502 }));
    await expect(refreshSession()).resolves.toBe(false);
    expect(received).not.toContain("session:expired");
  });

  it("recovers when the first attempt never lands [H-10]", async () => {
    const received = listen();
    fetchMock.mockRejectedValueOnce(new TypeError("Load failed")).mockResolvedValueOnce(json({}));
    await expect(refreshSession()).resolves.toBe(true);
    expect(received).not.toContain("session:expired");
  });

  it("fails as a network error, not as a dead session, when nothing lands [H-10]", async () => {
    const received = listen();
    fetchMock.mockRejectedValue(new TypeError("Load failed"));
    await expect(refreshSession()).rejects.toBeInstanceOf(NetworkError);
    expect(received).not.toContain("session:expired");
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
