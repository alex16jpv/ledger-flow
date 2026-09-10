import { describe, expect, it } from "vitest";

import { TEMPLATE_ID } from "@/lib/pwa/shell";

import { isEntityId } from "./entity-id";

describe("isEntityId", () => {
  it("accepts the ids the app and the backend generate", () => {
    expect(isEntityId("01a08c1f-024c-7bbe-b5b6-38d73bbfd050")).toBe(true);
    expect(isEntityId(TEMPLATE_ID)).toBe(true);
  });

  it("accepts either case, because a URL is not case-normalised", () => {
    expect(isEntityId("01A08C1F-024C-7BBE-B5B6-38D73BBFD050")).toBe(true);
  });

  // Each of these reached a detail screen with a 200 before T-03.
  it.each([
    "nope",
    "",
    "new",
    "01a08c1f024c7bbeb5b638d73bbfd050",
    "01a08c1f-024c-7bbe-b5b6-38d73bbfd05",
    "01a08c1f-024c-7bbe-b5b6-38d73bbfd050x",
    "01a08c1f-024c-7bbe-b5b6-38d73bbfd05g",
    " 01a08c1f-024c-7bbe-b5b6-38d73bbfd050",
  ])("refuses %o", (value) => {
    expect(isEntityId(value)).toBe(false);
  });

  it("refuses a missing segment", () => {
    expect(isEntityId(undefined)).toBe(false);
  });
});
