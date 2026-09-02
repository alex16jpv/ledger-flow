import { render, screen } from "@testing-library/react";

import { Progress, progressTone } from "./Progress";

describe("Progress", () => {
  it("switches tone at 80 % and past 100 %", () => {
    expect(progressTone(0.5)).toBe("ok");
    expect(progressTone(0.8)).toBe("warn");
    expect(progressTone(1.2)).toBe("over");
  });

  it("is an accessible progressbar with a clamped fill and a pace marker", () => {
    render(<Progress value={130} max={100} marker={0.7} label="Food budget" />);
    const bar = screen.getByRole("progressbar", { name: "Food budget" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(fill.className).toContain("bg-danger-solid");
    expect(bar.children).toHaveLength(2);
  });
});
