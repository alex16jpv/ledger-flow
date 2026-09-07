import { SESSION_COOKIE, sessionMarkerCookie } from "./cookies";
import { readSessionMarker, vaultUserFor } from "./marker";

// jsdom refuses to set a `__Host-` cookie over http, so the tests stub the read.
const withCookie = (value: string) => vi.spyOn(document, "cookie", "get").mockReturnValue(value);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the session marker", () => {
  it("reads the user whose vault this device holds", () => {
    withCookie(`lf_locale=es; ${SESSION_COOKIE}=${sessionMarkerCookie("u1", 2_000_000).value}`);
    expect(readSessionMarker()).toEqual({ userId: "u1", issuedAt: 2_000_000 });
  });

  it("is nothing when the cookie is not there", () => {
    withCookie("lf_locale=es");
    expect(readSessionMarker()).toBeNull();
  });

  it("does not confuse a cookie whose name ends the same way", () => {
    withCookie("not-__Host-session=u9.1000");
    expect(readSessionMarker()).toBeNull();
  });

  it("survives a marker without a timestamp", () => {
    withCookie("__Host-session=u1");
    expect(readSessionMarker()?.userId).toBe("u1");
  });
});

describe("which vault the app opens (§2.6)", () => {
  const marker = { userId: "u1", issuedAt: 1_000 };

  it("waits while the session is still being resolved", () => {
    expect(vaultUserFor(undefined, "loading", marker)).toBeUndefined();
  });

  it("opens the marker's vault once the session gives up", () => {
    expect(vaultUserFor(undefined, "resolved", marker)).toBe("u1");
  });

  it("opens nothing when there is no marker either", () => {
    expect(vaultUserFor(undefined, "resolved", null)).toBeUndefined();
  });

  it("lets the signed-in user win over a stale marker", () => {
    expect(vaultUserFor("u2", "resolved", marker)).toBe("u2");
  });
});
