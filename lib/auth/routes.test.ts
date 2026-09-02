import { isGuestOnlyPath, isPublicPath, safeNextPath, stripLocale } from "./routes";

describe("route rules", () => {
  it("strips the locale prefix", () => {
    expect(stripLocale("/es/settings", ["en", "es"])).toBe("/settings");
    expect(stripLocale("/es", ["en", "es"])).toBe("/");
    expect(stripLocale("/settings", ["en", "es"])).toBe("/settings");
    expect(stripLocale("/estonia", ["en", "es"])).toBe("/estonia");
  });

  it("knows the public surface", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/dev/ui")).toBe(true);
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/transactions/abc")).toBe(false);
    expect(isGuestOnlyPath("/register")).toBe(true);
  });

  it("only follows same-origin next paths", () => {
    expect(safeNextPath("/budgets?x=1")).toBe("/budgets?x=1");
    expect(safeNextPath("//evil.example")).toBe("/home");
    expect(safeNextPath("https://evil.example")).toBe("/home");
    expect(safeNextPath(null)).toBe("/home");
  });
});
