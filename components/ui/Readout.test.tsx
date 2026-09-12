import { render, screen } from "@testing-library/react";

import { Readout } from "./Readout";

describe("Readout", () => {
  it("puts the reading on the left and its amount on the right", () => {
    render(<Readout label="Wednesday, September 9 · 3 transactions" value="$214,000" />);
    expect(screen.getByText("Wednesday, September 9 · 3 transactions")).toBeInTheDocument();
    expect(screen.getByText("$214,000").className).toContain("tabular-nums");
  });

  it("keeps its height with nothing to say, so the line never moves the layout", () => {
    const { container } = render(<Readout label="" />);
    const line = container.querySelector("p");
    expect(line?.className).toContain("min-h-[18px]");
    expect(line?.childElementCount).toBe(1);
  });
});
