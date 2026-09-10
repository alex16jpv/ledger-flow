import { describe, expect, it } from "vitest";

import { namesUnknownRow } from "./entity-route";

const ID = "01a08c1f-024c-7bbe-b5b6-38d73bbfd050";

describe("namesUnknownRow", () => {
  // Each of these answered 200 before T-03 and then asked the server for a row that cannot exist.
  it.each([
    "/accounts/nope",
    "/accounts/nope/edit",
    "/transactions/nope",
    "/transactions/nope/edit",
    "/budgets/nope",
    "/budgets/nope/edit",
    "/categories/nope/edit",
  ])("refuses %s", (path) => {
    expect(namesUnknownRow(path)).toBe(true);
  });

  // The regression this caught on the first run: a static child sits where an id would.
  it.each([
    "/accounts/new",
    "/budgets/new",
    "/budgets/past",
    "/categories/new",
    "/transactions/new",
    "/transactions/review",
    "/home",
    "/settings/sessions",
    "/settings/sync",
    "/",
  ])("leaves %s alone", (path) => {
    expect(namesUnknownRow(path)).toBe(false);
  });

  it.each([`/accounts/${ID}`, `/accounts/${ID}/edit`, `/categories/${ID}/edit`])(
    "lets %s through, because only the row itself knows if it exists",
    (path) => {
      expect(namesUnknownRow(path)).toBe(false);
    },
  );

  it("says nothing about a path with no second segment", () => {
    expect(namesUnknownRow("/accounts")).toBe(false);
  });
});
