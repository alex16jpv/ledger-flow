import { readdirSync } from "node:fs";

import { isGuestOnlyPath, isProtectedPath, safeNextPath, stripLocale } from "./routes";

// `dev/pickers` is switched off by the componentCatalog flag, not by a session.
const FLAG_GUARDED = new Set(["dev"]);

describe("route rules", () => {
  it("strips the locale prefix", () => {
    expect(stripLocale("/es/settings", ["en", "es"])).toBe("/settings");
    expect(stripLocale("/es", ["en", "es"])).toBe("/");
    expect(stripLocale("/settings", ["en", "es"])).toBe("/settings");
    expect(stripLocale("/estonia", ["en", "es"])).toBe("/estonia");
  });

  it("knows which pages are for guests only", () => {
    expect(isGuestOnlyPath("/register")).toBe(true);
    // P-33: a signed-in device asking for the landing is asking for the app.
    expect(isGuestOnlyPath("/")).toBe(true);
    expect(isGuestOnlyPath("/privacy")).toBe(false);
  });

  it("asks for a session on every screen of the app group", () => {
    const screens = readdirSync("app/[locale]/(app)", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !FLAG_GUARDED.has(entry.name))
      .map((entry) => `/${entry.name}`);
    expect(screens).toContain("/sync");
    for (const screen of screens) {
      expect(isProtectedPath(screen)).toBe(true);
      expect(isProtectedPath(`${screen}/anything`)).toBe(true);
    }
    expect(isProtectedPath("/dev/pickers")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/homely")).toBe(false);
  });

  it("only follows same-origin next paths", () => {
    expect(safeNextPath("/budgets?x=1")).toBe("/budgets?x=1");
    expect(safeNextPath("//evil.example")).toBe("/home");
    expect(safeNextPath("https://evil.example")).toBe("/home");
    expect(safeNextPath(null)).toBe("/home");
  });

  it.each([
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/.//evil.example",
    "/a/..//evil.example",
    "/en//evil.example",
    "/es//evil.example",
    "javascript:alert(1)",
    "",
    undefined,
  ])("refuses %j as a next path", (value) => {
    expect(safeNextPath(value)).toBe("/home");
  });

  it("hands back the path the browser would open", () => {
    expect(safeNextPath("/budgets/../stats?p=1#top")).toBe("/stats?p=1#top");
    expect(safeNextPath("/%2F/evil.example")).toBe("/%2F/evil.example");
    expect(safeNextPath("//evil.example", "/onboarding")).toBe("/onboarding");
    expect(safeNextPath("/stats?from=//x#//y")).toBe("/stats?from=//x#//y");
  });
});
