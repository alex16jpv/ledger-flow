import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { Projected } from "./Projected";

describe("Projected", () => {
  it("leaves a figure the server sent exactly as it is", () => {
    renderWithProviders(
      <Projected when={false}>
        <span>1.000</span>
      </Projected>,
    );
    expect(screen.getByText("1.000")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("marks a figure that already carries unsynced writes", () => {
    renderWithProviders(
      <Projected when>
        <span>1.000</span>
      </Projected>,
    );
    expect(screen.getByRole("img", { name: "Includes changes not yet synced" })).toBeVisible();
  });
});
