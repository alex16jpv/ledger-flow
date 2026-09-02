import { isTrustedOrigin } from "./origin";

const APP = "https://ledgerflow.alexpiral.com";
const request = (
  headers: Record<string, string>,
  url = "https://ledgerflow.alexpiral.com/api/auth/login",
) => new Request(url, { method: "POST", headers });

describe("isTrustedOrigin", () => {
  it("accepts the configured app origin and the request's own host", () => {
    expect(isTrustedOrigin(request({ origin: APP }), APP)).toBe(true);
    expect(
      isTrustedOrigin(
        request(
          { origin: "http://localhost:3001", host: "localhost:3001" },
          "http://localhost:3001/api/auth/login",
        ),
        APP,
      ),
    ).toBe(true);
    expect(isTrustedOrigin(request({ referer: `${APP}/login` }), APP)).toBe(true);
  });

  it("rejects missing or foreign origins", () => {
    expect(isTrustedOrigin(request({}), APP)).toBe(false);
    expect(isTrustedOrigin(request({ origin: "https://evil.example" }), APP)).toBe(false);
    expect(isTrustedOrigin(request({ referer: "not a url" }), APP)).toBe(false);
  });
});
