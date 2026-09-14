import { releaseName, shortRelease } from "./release";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_VERSION", undefined);
  vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", undefined);
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("releaseName", () => {
  it("prefers what the deploy declares", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "v1.2.3");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "0".repeat(40));
    expect(releaseName()).toBe("v1.2.3");
  });

  it("falls back to the commit the browser can see", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
    expect(releaseName()).toBe("a".repeat(40));
  });

  it("falls back to the commit only the build can see", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "b".repeat(40));
    expect(releaseName()).toBe("b".repeat(40));
  });

  it("treats an empty variable as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "c".repeat(40));
    expect(releaseName()).toBe("c".repeat(40));
  });

  it("says dev where nothing is set", () => {
    expect(releaseName()).toBe("dev");
  });
});

describe("shortRelease", () => {
  it("cuts a commit sha and nothing else", () => {
    expect(shortRelease("d".repeat(40))).toBe("ddddddd");
    expect(shortRelease("v1.2.3-beta")).toBe("v1.2.3-beta");
    expect(shortRelease("dev")).toBe("dev");
  });
});

// H-60: the whole point is that these two are the same string; the module boundary is where it breaks.
it("names the release the same for the build and the browser", async () => {
  vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "e".repeat(40));
  // Both modules read the environment as they load, so the stub has to precede the import.
  vi.resetModules();
  const build = await import("./sentry-build");
  const runtime = await import("./sentry-options");

  expect(build.sentryBuildOptions.release.name).toBe("e".repeat(40));
  expect(runtime.sentryOptions().release).toBe(build.sentryBuildOptions.release.name);
});
