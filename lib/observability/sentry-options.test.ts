import { sentryOptions } from "./sentry-options";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sentryOptions", () => {
  it("names the deploy an event came from, falling back to the commit (H-21)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", undefined);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "0123456789abcdef");
    expect(sentryOptions().release).toBe("0123456789abcdef");

    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "v1.2.3");
    expect(sentryOptions().release).toBe("v1.2.3");
  });

  it("falls back to dev where neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", undefined);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", undefined);
    expect(sentryOptions().release).toBe("dev");
  });

  it("stays off without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    expect(sentryOptions().enabled).toBe(false);
  });
});
