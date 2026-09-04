import { ApiError, NetworkError } from "@/lib/api/errors";

import { createQueryClient, retryDelayWithJitter, shouldRetryQuery } from "./client";
import { QUERY_DOMAINS } from "./domains";
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
    expect(cacheDatabaseName("u1")).toBe("lf-cache-u1");
  });

  // Paused fetches never reach the repository, so the mirror could never answer them (O-F2a).
  it("lets the mirror-backed domains fetch while offline, and pauses the rest", () => {
    const client = createQueryClient();
    expect(client.getQueryDefaults(QUERY_DOMAINS.accounts).networkMode).toBe("offlineFirst");
    expect(client.getQueryDefaults(QUERY_DOMAINS.categories).networkMode).toBe("offlineFirst");
    expect(client.getQueryDefaults(QUERY_DOMAINS.transactions).networkMode).toBeUndefined();
  });
});
