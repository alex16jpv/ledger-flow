import { describe, expect, it } from "vitest";

import { acceptedPolicyVersion, CURRENT_POLICY } from "@/lib/legal";

describe("acceptedPolicyVersion", () => {
  it("gives the current version to an account created on its first day in Bogotá", () => {
    expect(acceptedPolicyVersion(new Date(`${CURRENT_POLICY.effective}T00:00:00-05:00`))).toBe(
      CURRENT_POLICY.version,
    );
  });

  it("gives the previous version to an account created the instant before", () => {
    const before = Date.parse(`${CURRENT_POLICY.effective}T00:00:00-05:00`) - 1;
    expect(acceptedPolicyVersion(new Date(before))).toBe(CURRENT_POLICY.version - 1);
  });

  it("gives the first version to an account older than every policy", () => {
    expect(acceptedPolicyVersion(new Date("2026-01-01T00:00:00Z"))).toBe(1);
  });
});
