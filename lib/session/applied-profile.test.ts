import { appliedProfile } from "./applied-profile";

const T1 = "2026-10-05T10:00:00.000Z";
const T2 = "2026-10-05T11:00:00.000Z";

beforeEach(() => {
  window.localStorage.clear();
});

describe("appliedProfile", () => {
  it("takes any profile as news until one was applied", () => {
    expect(appliedProfile.isNews("u1", "theme", T1)).toBe(true);
  });

  it("takes only a later profile as news, field by field", () => {
    appliedProfile.note("u1", "theme", T2);

    expect(appliedProfile.isNews("u1", "theme", T1)).toBe(false);
    expect(appliedProfile.isNews("u1", "theme", T2)).toBe(false);
    expect(appliedProfile.isNews("u1", "locale", T1)).toBe(true);
  });

  it("never moves back to an older profile", () => {
    appliedProfile.note("u1", "locale", T2);
    appliedProfile.note("u1", "locale", T1);

    expect(appliedProfile.isNews("u1", "locale", T2)).toBe(false);
  });

  it("starts over for another account, and after being forgotten", () => {
    appliedProfile.note("u1", "theme", T2);
    expect(appliedProfile.isNews("u2", "theme", T1)).toBe(true);

    appliedProfile.forget();
    expect(appliedProfile.isNews("u1", "theme", T1)).toBe(true);
  });
});
