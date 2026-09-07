import { shellReadiness } from "./readiness";
import { SHELL_CACHE, SHELL_SCREENS, shellCacheKey, shellUrls } from "./shell";

const store = new Map<string, Set<string>>();

const fakeCaches = {
  open: (name: string) =>
    Promise.resolve({
      match: (key: string) => Promise.resolve(store.get(name)?.has(key) === true ? {} : undefined),
    }),
};

function warm(urls: readonly string[]): void {
  store.set(SHELL_CACHE, new Set(urls.map((url) => shellCacheKey(url))));
}

beforeEach(() => {
  store.clear();
  vi.stubGlobal("caches", fakeCaches);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("how ready this device is to run with no network", () => {
  it("counts the screens the worker warmed against the ones it should have", async () => {
    const urls = shellUrls("en", window.location.origin);
    warm(urls.slice(0, 3));

    expect(await shellReadiness("en")).toEqual({ cached: 3, expected: SHELL_SCREENS });
  });

  it("is ready only when every screen is there", async () => {
    warm(shellUrls("en", window.location.origin));

    const readiness = await shellReadiness("en");
    expect(readiness.cached).toBe(readiness.expected);
  });

  // A device warmed in Spanish holds Spanish documents: English is a set of screens it never asked
  // for, and promising it works with no network would be a lie.
  it("counts the language it is asked about, not the one it warmed", async () => {
    warm(shellUrls("es", window.location.origin));

    expect((await shellReadiness("en")).cached).toBe(0);
    expect((await shellReadiness("es")).cached).toBe(SHELL_SCREENS);
  });

  it("promises nothing where the browser has no cache at all", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await shellReadiness("en")).toEqual({ cached: 0, expected: SHELL_SCREENS });
  });
});
