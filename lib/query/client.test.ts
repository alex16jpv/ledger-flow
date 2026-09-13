import { onlineManager, QueryObserver } from "@tanstack/react-query";

import { ApiError, NetworkError } from "@/lib/api/errors";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";

import { createQueryClient, retryDelayWithJitter, shouldRetryQuery } from "./client";
import { MIRROR_BACKED_DOMAINS, QUERY_DOMAINS } from "./domains";
import { cacheDatabaseName } from "./purge";

// H-08: these two are process-wide singletons, so a test that moves them puts them back.
afterEach(() => {
  onlineManager.setOnline(true);
  connectivityStore.reset();
  vi.useRealTimers();
});

describe("query client defaults", () => {
  it("retries once, only for transient failures", () => {
    const server = new ApiError({
      status: 503,
      code: "DB_UNAVAILABLE",
      message: "x",
      requestId: "r",
    });
    const client = new ApiError({ status: 404, code: null, message: "x", requestId: "r" });
    expect(shouldRetryQuery(0, server)).toBe(true);
    expect(shouldRetryQuery(1, server)).toBe(false);
    expect(shouldRetryQuery(0, client)).toBe(false);
    expect(shouldRetryQuery(0, new NetworkError("r", true))).toBe(true);
  });

  // Puerta O-A: a paused retry never resolves the invalidation, and the form spins for ever.
  it("does not ask for a retry it cannot get while offline", () => {
    reportOnline(false);
    expect(connectivityStore.getSnapshot()).toBe("offline");
    expect(shouldRetryQuery(0, new NetworkError("r", true))).toBe(false);
    connectivityStore.reset();
    expect(shouldRetryQuery(0, new NetworkError("r", true))).toBe(true);
  });

  // H-17: the retry is granted while the store still says online, and the heartbeat then pauses it.
  it("does not leave a read paused for ever when the network drops during its retry", async () => {
    vi.useFakeTimers();
    const client = createQueryClient();
    const observer = new QueryObserver(client, {
      queryKey: [...QUERY_DOMAINS.budgets, "h17"],
      queryFn: () => Promise.reject(new NetworkError("r", true)),
      retryDelay: 20,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1);
    onlineManager.setOnline(false);
    await vi.advanceTimersByTimeAsync(500);
    const result = observer.getCurrentResult();
    unsubscribe();
    expect(result.fetchStatus).not.toBe("paused");
    expect(result.status).toBe("error");
  });

  it("backs off exponentially with jitter and never beyond the cap", () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const delay = retryDelayWithJitter(attempt);
      expect(delay).toBeGreaterThanOrEqual(Math.min(1000 * 2 ** attempt, 8000) / 2);
      expect(delay).toBeLessThanOrEqual(8000);
    }
  });

  it("sets 30 s staleTime and no mutation retries", () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().queries?.staleTime).toBe(30_000);
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
    // A paused mutation never runs its mutationFn, so the outbox of O-F4 was never reached.
    expect(client.getDefaultOptions().mutations?.networkMode).toBe("offlineFirst");
    expect(cacheDatabaseName("u1")).toBe("lf-cache-u1");
  });

  // H-17: no read of this app has a reason to wait for the network instead of failing.
  it("lets every read fetch while offline, and still refetches when the network returns", () => {
    const client = createQueryClient();
    const defaults = client.defaultQueryOptions({ queryKey: [...QUERY_DOMAINS.budgets, "x"] });
    expect(defaults.networkMode).toBe("always");
    // React Query derives this from networkMode, so "always" turns it off unless it is declared.
    expect(defaults.refetchOnReconnect).toBe(true);
    expect(client.defaultQueryOptions({ queryKey: ["settings", "sessions"] }).networkMode).toBe(
      "always",
    );
  });

  // O-F2a: a domain added without a local read has to stay out of the invalidation list.
  it("invalidates every mirror-backed domain and no other", () => {
    expect([...MIRROR_BACKED_DOMAINS].flat().sort()).toEqual(
      Object.values(QUERY_DOMAINS).flat().sort(),
    );
  });
});
