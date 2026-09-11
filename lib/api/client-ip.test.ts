// @vitest-environment node
vi.mock("server-only", () => ({}));

import { clientIpOf } from "./client-ip";

const request = (headers: Record<string, string>): Request =>
  new Request("http://app.test/api/auth/login", { method: "POST", headers });

describe("clientIpOf", () => {
  it("reads the address the platform reports", () => {
    expect(clientIpOf(request({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("takes the first entry of a forwarded list when there is no single address", () => {
    expect(clientIpOf(request({ "x-forwarded-for": "203.0.113.7, 76.76.21.21" }))).toBe(
      "203.0.113.7",
    );
  });

  it("prefers the platform's single address over a forwarded list", () => {
    expect(
      clientIpOf(
        request({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.4, 76.76.21.21" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("ignores an x-client-ip the browser sent itself", () => {
    expect(clientIpOf(request({ "x-client-ip": "203.0.113.7" }))).toBeNull();
  });

  it("returns null where no address is reported, as in local development", () => {
    expect(clientIpOf(request({}))).toBeNull();
  });

  it("returns null for a value that is not an address", () => {
    expect(clientIpOf(request({ "x-real-ip": "unknown" }))).toBeNull();
    expect(clientIpOf(request({ "x-forwarded-for": "" }))).toBeNull();
  });

  it("accepts an IPv6 address", () => {
    expect(clientIpOf(request({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});
