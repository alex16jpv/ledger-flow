// @vitest-environment node
vi.mock("server-only", () => ({}));

const fetchMock = vi.fn<typeof fetch>();

async function loadBackendFetch(secret: string | undefined) {
  vi.resetModules();
  vi.stubEnv("API_URL", "http://backend.test");
  if (secret === undefined) vi.stubEnv("API_SECRET", "");
  else vi.stubEnv("API_SECRET", secret);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://app.test");
  vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "team@app.test");
  vi.stubGlobal("fetch", fetchMock);
  return (await import("./backend")).backendFetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("backendFetch", () => {
  it("sends the gateway secret header when API_SECRET is configured", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    const backendFetch = await loadBackendFetch("top-secret");
    await backendFetch("/health/db", { accessToken: "jwt" });
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://backend.test/health/db");
    expect(headers.get("x-api-secret")).toBe("top-secret");
    expect(headers.get("authorization")).toBe("Bearer jwt");
  });

  it("omits the header locally, where the backend runs without a secret", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    const backendFetch = await loadBackendFetch(undefined);
    await backendFetch("/health/db");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("x-api-secret")).toBe(false);
  });
});
