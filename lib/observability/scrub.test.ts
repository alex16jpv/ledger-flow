import type { ErrorEvent } from "@sentry/nextjs";

import { redactNumbers, scrubBreadcrumb, scrubEvent } from "./scrub";

describe("redactNumbers", () => {
  it("hides amounts and dates but keeps short numbers", () => {
    expect(redactNumbers("Paid 1.250.000 on 2026-09-02, status 500")).toBe(
      "Paid # on #-09-02, status 500",
    );
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console output and keeps only method, status and path of requests", () => {
    expect(scrubBreadcrumb({ category: "console", message: "amount 12.000" })).toBeNull();
    expect(
      scrubBreadcrumb({
        category: "fetch",
        message: "GET /api/transactions?q=rent",
        data: { method: "GET", status_code: 500, url: "/api/transactions?q=rent&amount=1000" },
      }),
    ).toEqual({
      category: "fetch",
      message: undefined,
      data: { method: "GET", status_code: 500, url: "/api/transactions" },
    });
  });

  it("strips query strings from navigation crumbs", () => {
    expect(
      scrubBreadcrumb({ category: "navigation", data: { from: "/a?q=1", to: "/b#x" } }),
    ).toEqual({
      category: "navigation",
      data: { from: "/a", to: "/b" },
    });
  });
});

describe("scrubEvent", () => {
  it("removes user, extras, headers, cookies and bodies and redacts numbers in messages", () => {
    const event = {
      message: "Failed saving 45.000",
      user: { id: "u1", email: "a@b.c" },
      extra: { body: { amount: 1 } },
      request: {
        method: "POST",
        url: "https://app.test/api/transactions?q=rent",
        headers: { cookie: "__Host-at=secret" },
        cookies: { "__Host-at": "secret" },
        data: '{"amount":1000}',
      },
      tags: { request_id: "req-1" },
      breadcrumbs: [
        { category: "console", message: "hi" },
        { category: "fetch", data: { method: "GET", status_code: 200, url: "/api/x?y=1" } },
      ],
      exception: { values: [{ type: "ApiError", value: "Amount 1.000.000 rejected" }] },
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.request).toEqual({ method: "POST", url: "https://app.test/api/transactions" });
    expect(scrubbed.tags).toEqual({ request_id: "req-1" });
    expect(scrubbed.message).toBe("Failed saving #");
    expect(scrubbed.breadcrumbs).toEqual([
      {
        category: "fetch",
        message: undefined,
        data: { method: "GET", status_code: 200, url: "/api/x" },
      },
    ]);
    expect(scrubbed.exception?.values?.[0]?.value).toBe("Amount # rejected");
  });
});
