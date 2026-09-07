import { render, screen } from "@testing-library/react";

import { Progress, progressTone } from "./Progress";

describe("Progress", () => {
  it("switches tone at 80 % and past 100 %", () => {
    expect(progressTone(0.5)).toBe("ok");
    expect(progressTone(0.8)).toBe("warn");
    expect(progressTone(1.2)).toBe("over");
  });

  it("is an accessible progressbar with a clamped fill", () => {
    render(<Progress value={130} max={100} marker={0.7} label="Food budget" />);
    const bar = screen.getByRole("progressbar", { name: "Food budget" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(fill.className).toContain("bg-danger-solid");
  });

  // F-08: the mark had no name and no way to ask what it was.
  it("makes the pace mark a control that says what it marks", () => {
    render(
      <Progress
        value={60}
        max={100}
        marker={0.73}
        markerLabel="Day 22 of 30 · 73% expected"
        label="Food budget"
      />,
    );
    const mark = screen.getByRole("button", { name: "Day 22 of 30 · 73% expected" });
    expect(mark.parentElement).toHaveStyle({ left: "73%" });
    // The bubble repeats it for the eye only: the control already carries the name (7.23).
    expect(mark.parentElement).toHaveTextContent("Day 22 of 30 · 73% expected");
  });

  it("leaves the mark silent where there is nothing to say about it", () => {
    render(<Progress value={60} max={100} marker={0.73} label="Food budget" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
