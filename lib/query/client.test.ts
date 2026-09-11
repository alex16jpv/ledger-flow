import { ApiError, NetworkError } from "@/lib/api/errors";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";

import { createQueryClient, retryDelayWithJitter, shouldRetryQuery } from "./client";
import { MIRROR_BACKED_DOMAINS, QUERY_DOMAINS } from "./domains";
import { cacheDatabaseName } from "./purge";

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

  // O-F2a: a domain added without a local read has to stay out of the list.
  it("lets every mirror-backed domain fetch while offline", () => {
    const client = createQueryClient();
    for (const queryKey of Object.values(QUERY_DOMAINS)) {
      expect(client.getQueryDefaults(queryKey).networkMode).toBe("offlineFirst");
    }
    expect([...MIRROR_BACKED_DOMAINS].flat().sort()).toEqual(
      Object.values(QUERY_DOMAINS).flat().sort(),
    );
  });
});
