import { buildCsp, cspHeaderName, newNonce, staticSecurityHeaders } from "./csp";

describe("buildCsp", () => {
  it("uses a per-request nonce and locks connect-src to self", () => {
    const csp = buildCsp({ nonce: "abc", isDevelopment: false, reportUri: "/api/csp-report" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows eval and same-origin framing only in development", () => {
    const dev = buildCsp({ nonce: "n", isDevelopment: true, reportUri: "/r" });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("frame-ancestors 'self'");
    expect(staticSecurityHeaders(true).find((h) => h.key === "X-Frame-Options")?.value).toBe(
      "SAMEORIGIN",
    );
    expect(staticSecurityHeaders(false).find((h) => h.key === "X-Frame-Options")?.value).toBe(
      "DENY",
    );
  });

  it("names the report-only header during the rollout", () => {
    expect(cspHeaderName(true)).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName(false)).toBe("Content-Security-Policy");
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
