import { QueryClient } from "@tanstack/react-query";

import { unsentTheme } from "@/lib/theme/unsent";

import { appliedProfile } from "./applied-profile";
import { forgetSessionHere } from "./sign-out";

describe("forgetSessionHere", () => {
  it("forgets the theme still to send and what this device applied of the profile", async () => {
    unsentTheme.mark("u1", { palette: "tinta", mode: "dark" });
    appliedProfile.note("u1", "locale", "2026-10-05T10:00:00.000Z");

    await forgetSessionHere(new QueryClient(), null);

    expect(unsentTheme.read("u1")).toBeNull();
    expect(appliedProfile.isNews("u1", "locale", "2026-10-05T09:00:00.000Z")).toBe(true);
  });
});
