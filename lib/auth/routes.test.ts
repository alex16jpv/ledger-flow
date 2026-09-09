import { readdirSync } from "node:fs";

import {
  isGuestOnlyPath,
  isProtectedPath,
  isPublicPath,
  safeNextPath,
  stripLocale,
} from "./routes";

// `dev/pickers` is the pickers bench: it lives in the group for the app frame, and what switches it
// off is the componentCatalog flag, not a session (tools/check-dev-routes.mjs measures that).
const FLAG_GUARDED = new Set(["dev"]);

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
});
