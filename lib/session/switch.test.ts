import type { SessionMarker } from "@/lib/auth/cookies";

import { noteAccountSwitched, sessionChangeOf, takeAccountSwitched } from "./switch";

const ada: SessionMarker = { userId: "ada", issuedAt: 1_758_000_000_000 };
const adaAgain: SessionMarker = { userId: "ada", issuedAt: 1_758_000_600_000 };
const grace: SessionMarker = { userId: "grace", issuedAt: 1_758_000_600_000 };

describe("sessionChangeOf", () => {
  it("is a switch when the browser's session belongs to someone else", () => {
    expect(sessionChangeOf("ada", ada, grace, false)).toBe("switched");
    expect(sessionChangeOf("ada", ada, grace, true)).toBe("switched");
  });

  it("resumes a dead session only when its owner signed in again", () => {
    expect(sessionChangeOf("ada", ada, adaAgain, true)).toBe("resumed");
    expect(sessionChangeOf("ada", ada, ada, true)).toBeNull();
    expect(sessionChangeOf("ada", ada, adaAgain, false)).toBeNull();
  });

  it("judges the switch by the marker the page loaded with, not by who the session says", () => {
    expect(sessionChangeOf("grace", ada, ada, false)).toBeNull();
    expect(sessionChangeOf("grace", ada, grace, false)).toBe("switched");
    expect(sessionChangeOf("ada", null, grace, false)).toBe("switched");
  });

  it("leaves a signed-out browser to the logout", () => {
    expect(sessionChangeOf("ada", ada, null, true)).toBeNull();
  });

  it("never keeps reloading over a marker whose date cannot be read", () => {
    const unreadable: SessionMarker = { userId: "ada", issuedAt: Number.NaN };
    expect(sessionChangeOf("ada", unreadable, unreadable, true)).toBeNull();
  });
});

describe("the switch notice", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("is taken once", () => {
    noteAccountSwitched();
    expect(takeAccountSwitched()).toBe(true);
    expect(takeAccountSwitched()).toBe(false);
  });

  it("is simply lost when the browser refuses the storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => {
      noteAccountSwitched();
    }).not.toThrow();
    setItem.mockRestore();
    expect(takeAccountSwitched()).toBe(false);
  });
});
