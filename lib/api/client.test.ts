import { connectivityStore, onNetworkFailure, reportOnline } from "@/lib/network/connectivity";

import { api, setUnauthorizedHandler } from "./client";
import { ApiError, NetworkError } from "./errors";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setUnauthorizedHandler(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("calls the proxy with JSON, a request id and the query string", async () => {
    fetchMock.mockResolvedValue(json({ data: [] }));
    const result = await api<{ data: unknown[] }>("/transactions", {
      query: { limit: 5, cursor: undefined, pendingDetails: true },
    });
    expect(result).toEqual({ data: [] });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/transactions?limit=5&pendingDetails=true");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.accept).toBe("application/json");
  });

  // F-64: an answer — any answer — is the app's proof that the network is back, and the only one it
  // gets while it believes it is offline and has stopped asking.
  it("reports an answer that came back while the app believed it was offline", async () => {
    const asked = vi.fn();
    const stop = onNetworkFailure(asked);
    connectivityStore.reset();
    fetchMock.mockResolvedValue(json({ code: "UNAUTHORIZED", message: "no" }, { status: 401 }));
    await api("/transactions").catch(() => undefined);
    expect(asked).not.toHaveBeenCalled();

    reportOnline(false);
    await api("/transactions").catch(() => undefined);
    expect(asked).toHaveBeenCalledTimes(1);
    stop();
    connectivityStore.reset();
  });

  it("sends the body and the Idempotency-Key", async () => {
    fetchMock.mockResolvedValue(json({ id: "t1" }, { status: 201 }));
    await api("/transactions/quick", {
      method: "POST",
      body: { amount: 12500 },
      idempotencyKey: "key-1",
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ amount: 12500 }));
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  });

  it("throws an ApiError carrying code, details, requestId and Retry-After", async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: "TooMany", message: "slow down", code: "RATE_LIMITED" },
        { status: 429, headers: { "retry-after": "120", "x-request-id": "srv-1" } },
      ),
    );
    const error = await api("/auth/login", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(429);
    expect(apiError.code).toBe("RATE_LIMITED");
    expect(apiError.retryAfterSeconds).toBe(120);
    expect(apiError.requestId).toBe("srv-1");
  });

  it("keeps the code null when the backend sends an unknown one", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "NotFound", message: "nope", code: "BRAND_NEW" }, { status: 404 }),
    );
    const error = (await api("/accounts/x").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBeNull();
    expect(error.status).toBe(404);
  });

  it("regenerates the key and retries once on IDEMPOTENCY_PAYLOAD_MISMATCH", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ error: "x", message: "x", code: "IDEMPOTENCY_PAYLOAD_MISMATCH" }, { status: 422 }),
      )
      .mockResolvedValueOnce(json({ id: "t2" }, { status: 201 }));
    const result = await api<{ id: string }>("/transactions", {
      method: "POST",
      body: { amount: 1 },
      idempotencyKey: "k",
    });
    expect(result.id).toBe("t2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(retryHeaders["Idempotency-Key"]).not.toBe("k");
  });

  it("retries once after the unauthorized handler recovers the session", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "Unauthorized", message: "expired" }, { status: 401 }))
      .mockResolvedValueOnce(json({ ok: true }));
    const handler = vi.fn().mockResolvedValue(true);
    setUnauthorizedHandler(handler);
    await expect(api("/users/me")).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the 401 when the handler cannot recover", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Unauthorized", message: "expired" }, { status: 401 }),
    );
    setUnauthorizedHandler(vi.fn().mockResolvedValue(false));
    await expect(api("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wraps network failures and timeouts", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("/accounts")).rejects.toBeInstanceOf(NetworkError);
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    const error = (await api("/accounts").catch((e: unknown) => e)) as NetworkError;
    expect(error.timedOut).toBe(true);
  });
});
