import { render, screen } from "@testing-library/react";

import { Trend, type TrendLine } from "./Trend";

const LINES: TrendLine[] = [
  { points: [0, 50, 100, 150, 200], tone: "pace" },
  { points: [null, null, 120, 160, 200], tone: "projection" },
  { points: [0, 60, 120, null, null], tone: "spent", dot: true },
];

const pathsOf = (container: HTMLElement) => [...container.querySelectorAll("path")];

describe("Trend", () => {
  it("reads as one image, because a line has no slots to focus", () => {
    render(<Trend lines={LINES} label="Spent so far against the pace" />);
    expect(screen.getByRole("img", { name: "Spent so far against the pace" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("draws a gap as a gap and never interpolates it backwards", () => {
    const { container } = render(<Trend lines={LINES} label="Pace" />);
    const projection = pathsOf(container).find((path) =>
      path.getAttribute("class")?.includes("opacity-55"),
    );
    // It starts at today and nowhere earlier: one M, and no segment over the days that happened.
    expect(projection?.getAttribute("d")).toBe("M150 40 L225 20 L300 0");
  });

  it("ends the live line in a dot and paints it danger once it is over", () => {
    const { container } = render(
      <Trend lines={[{ points: [0, 60], tone: "over", dot: true }]} label="Pace" />,
    );
    const dot = container.querySelector("circle");
    expect(dot).toHaveAttribute("cx", "300");
    expect(dot?.getAttribute("class")).toContain("fill-danger");
  });

  it("puts the limit where its own share of the tallest figure is", () => {
    const { container } = render(
      <Trend lines={[{ points: [0, 200], tone: "spent" }]} label="Pace" limit={100} />,
    );
    const rule = pathsOf(container)[0];
    expect(rule?.getAttribute("d")).toBe("M0 50 L300 50");
    expect(rule?.getAttribute("class")).toContain("[stroke-dasharray:5_4]");
  });

  it("draws nothing off the top when every figure is zero", () => {
    const { container } = render(
      <Trend lines={[{ points: [0, 0, 0], tone: "spent" }]} label="Pace" />,
    );
    expect(pathsOf(container)[0]?.getAttribute("d")).toBe("M0 100 L150 100 L300 100");
  });
});
