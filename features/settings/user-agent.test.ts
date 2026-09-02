import { describeUserAgent } from "./user-agent";

describe("describeUserAgent", () => {
  it("names the platform and browser and picks a device kind", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
      ),
    ).toEqual({ kind: "phone", label: "Android · Chrome" });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0",
      ),
    ).toEqual({ kind: "laptop", label: "Windows · Edge" });
    expect(describeUserAgent(undefined)).toEqual({ kind: "desktop", label: null });
  });
});
