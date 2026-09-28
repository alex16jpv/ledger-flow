import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { HumanCheckFailed } from "./HumanCheckFailed";

describe("HumanCheckFailed", () => {
  it("says the check failed and what may be blocking it", () => {
    renderWithProviders(<HumanCheckFailed />);
    expect(screen.getByText("We couldn’t check that you’re a person.")).toBeInTheDocument();
    expect(screen.getByText(/content blocker/)).toBeInTheDocument();
  });
});
