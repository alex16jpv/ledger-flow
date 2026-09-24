import type { User } from "@/types/api";

import { profileResolved } from "./profile";

const user = { id: "u1", timezone: "Europe/Madrid", currency: "EUR" } as User;

describe("profileResolved", () => {
  it("is resolved as soon as anyone says who this is", () => {
    expect(profileResolved({ user, sessionStatus: "loading", mirrorPending: true })).toBe(true);
    expect(profileResolved({ user, sessionStatus: "authenticated", mirrorPending: false })).toBe(
      true,
    );
  });

  it("waits while the session is still asking", () => {
    expect(profileResolved({ user: null, sessionStatus: "loading", mirrorPending: false })).toBe(
      false,
    );
  });

  it("waits offline, or in local mode, while the copy on the device is being read", () => {
    expect(profileResolved({ user: null, sessionStatus: "error", mirrorPending: true })).toBe(
      false,
    );
    expect(profileResolved({ user: null, sessionStatus: "expired", mirrorPending: true })).toBe(
      false,
    );
  });

  it("gives up on nobody once both have answered, so the fallbacks stand", () => {
    expect(profileResolved({ user: null, sessionStatus: "error", mirrorPending: false })).toBe(
      true,
    );
    expect(profileResolved({ user: null, sessionStatus: "expired", mirrorPending: false })).toBe(
      true,
    );
  });
});
