import { isShellPath, offlineDocument, SHELL_PATHS, shellCacheKey, shellUrls } from "./shell";

describe("isShellPath", () => {
  it("covers every (app) route, in both locales", () => {
    for (const path of SHELL_PATHS) {
      expect(isShellPath(path), path).toBe(true);
      expect(isShellPath(`/es${path}`), path).toBe(true);
    }
    expect(isShellPath("/accounts/a1/edit")).toBe(true);
  });

  it("leaves the public routes to the default rules", () => {
    for (const path of ["/", "/es", "/login", "/register", "/privacy", "/es/terms"]) {
      expect(isShellPath(path), path).toBe(false);
    }
  });
});

describe("shellCacheKey", () => {
  // F-06: the filter and Next's own `_rsc` token change the URL and not the answer.
  it("keeps one entry per route, whatever the query string says", () => {
    expect(shellCacheKey("https://app.test/transactions?type=EXPENSE&_rsc=abc")).toBe(
      "https://app.test/transactions",
    );
    expect(shellCacheKey("https://app.test/transactions")).toBe("https://app.test/transactions");
  });
});

describe("offlineDocument", () => {
  it("answers in the locale of the route that could not be reached", () => {
    expect(offlineDocument("/budgets")).toBe("/offline.html");
    expect(offlineDocument("/es/budgets")).toBe("/offline.es.html");
  });
});

describe("shellUrls", () => {
  it("prefixes every route but the default locale's", () => {
    expect(shellUrls("en", "https://app.test")).toContain("https://app.test/home");
    expect(shellUrls("es", "https://app.test")).toContain("https://app.test/es/home");
    expect(shellUrls("es", "https://app.test")).toHaveLength(SHELL_PATHS.length);
  });
});
