import { fireEvent, render, screen } from "@testing-library/react";

import { Trend, type TrendLine } from "./Trend";

const LINES: TrendLine[] = [
  { points: [0, 50, 100, 150, 200], tone: "pace" },
  { points: [null, null, 120, 160, 200], tone: "projection" },
  { points: [0, 60, 120, null, null], tone: "spent", dot: true },
];

const pathsOf = (container: HTMLElement) => [...container.querySelectorAll("path")];

const SPAN = 5;

// jsdom measures everything as zero, and the reading is the pointer's share of the chart's width.
function surface(container: HTMLElement): HTMLElement {
  const found = container.querySelector("span.touch-pan-y");
  if (!(found instanceof HTMLElement)) throw new Error("no reading surface");
  found.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
  return found;
}

const atPosition = (index: number) => (index / (SPAN - 1)) * 300;

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

  it("has no slots, no readout and no guide until it is given readings", () => {
    const { container } = render(<Trend lines={LINES} label="Pace" />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelector(".stroke-border-strong")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("reads the pointed position on every line, and marks it", () => {
    const { container } = render(
      <Trend
        lines={LINES}
        label="Pace"
        points={[null, { label: "Day 1 - 60" }, { label: "Day 2 - 120" }, null, null]}
      />,
    );
    // With nothing pointed at, the line reads the last position that has a reading, and no bubble.
    expect(screen.getAllByText(/^Day \d - \d+$/)).toHaveLength(1);
    expect(screen.getByText("Day 2 - 120")).toBeInTheDocument();
    expect(container.querySelector("path.stroke-border-strong")).toBeNull();
    expect(container.querySelectorAll("circle")).toHaveLength(1);

    fireEvent.pointerMove(surface(container), {
      pointerType: "mouse",
      clientX: atPosition(1),
    });
    // Two lines reach day 1, the projection has not started, and the live line keeps its end dot.
    expect(screen.getAllByText("Day 1 - 60")).toHaveLength(2);
    expect(screen.queryByText("Day 2 - 120")).toBeNull();
    expect(container.querySelector("path.stroke-border-strong")).not.toBeNull();
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("keeps the origin and the days a line never reached out of the reading", () => {
    const { container } = render(
      <Trend
        lines={LINES}
        label="Pace"
        points={[null, { label: "Day 1 - 60" }, null, null, null]}
      />,
    );
    fireEvent.pointerMove(surface(container), {
      pointerType: "mouse",
      clientX: atPosition(0),
    });
    expect(container.querySelector("path.stroke-border-strong")).toBeNull();
  });

  it("reads where a finger lands and every position it slides across", () => {
    const { container } = render(
      <Trend
        lines={LINES}
        label="Pace"
        points={[null, { label: "Day 1 - 60" }, { label: "Day 2 - 120" }, null, null]}
      />,
    );
    const reading = surface(container);
    fireEvent.pointerDown(reading, { pointerType: "touch", clientX: atPosition(1) });
    expect(screen.getAllByText("Day 1 - 60")).toHaveLength(2);
    fireEvent.pointerMove(reading, { pointerType: "touch", clientX: atPosition(2) });
    expect(screen.getAllByText("Day 2 - 120")).toHaveLength(2);
    // The reading stays where the finger left it: lifting it is not the same as leaving the chart.
    fireEvent.pointerUp(reading, { pointerType: "touch" });
    expect(screen.getAllByText("Day 2 - 120")).toHaveLength(2);
  });

  it("ignores a finger that passes over without pressing, so a scroll reads nothing", () => {
    const { container } = render(
      <Trend
        lines={LINES}
        label="Pace"
        points={[null, { label: "Day 1 - 60" }, { label: "Day 2 - 120" }, null, null]}
      />,
    );
    fireEvent.pointerMove(surface(container), { pointerType: "touch", clientX: atPosition(1) });
    expect(screen.queryByText("Day 1 - 60")).toBeNull();
    expect(container.querySelector("path.stroke-border-strong")).toBeNull();
  });

  it("leaves the page its own vertical scroll over the chart", () => {
    const { container } = render(
      <Trend lines={LINES} label="Pace" points={[null, { label: "Day 1 - 60" }]} />,
    );
    expect(surface(container)).toHaveClass("touch-pan-y");
  });
});
