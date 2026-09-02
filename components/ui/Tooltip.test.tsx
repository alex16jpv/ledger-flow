import { render, screen } from "@testing-library/react";

import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("renders the hint next to the control without adding it to the accessibility tree", () => {
    render(
      <Tooltip label="Teal">
        <button type="button" aria-label="Teal" />
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Teal" })).toBeInTheDocument();
    expect(screen.getByText("Teal")).toHaveAttribute("aria-hidden", "true");
  });
});
