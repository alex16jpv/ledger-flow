import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { SyncBadge } from "./SyncBadge";

describe("SyncBadge", () => {
  it("says a queued write is waiting", () => {
    renderWithProviders(<SyncBadge sync="pending" />);
    expect(screen.getByText("Pending sync")).toBeVisible();
  });

  it("says a refused or conflicting write needs the user", () => {
    renderWithProviders(<SyncBadge sync="attention" />);
    expect(screen.getByText("Needs attention")).toBeVisible();
  });
});
