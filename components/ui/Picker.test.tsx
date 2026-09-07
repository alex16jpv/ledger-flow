import { render, screen } from "@testing-library/react";

import { Picker } from "./Picker";

describe("Picker", () => {
  it("shows the placeholder when empty and the value otherwise", () => {
    const { rerender } = render(<Picker label="Account" placeholder="Choose an account" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByText("Choose an account").className).toContain("text-text-3");
    rerender(<Picker label="Account" placeholder="Choose an account" value="Bancolombia" />);
    expect(screen.getByText("Bancolombia").className).toContain("font-medium");
  });
});
