import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Heat, type HeatCell } from "./Heat";

const COLUMNS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SCALE = { less: "Less", more: "More" };

// A fortnight starting on a Tuesday, so the grid needs one pad cell and spills into a third row.
const CELLS: HeatCell[] = Array.from({ length: 14 }, (_, index) => {
  const value = index === 8 ? 1000 : index % 3 === 0 ? 0 : index * 10;
  return {
    value,
    text: String(index + 1),
    label: `Day ${String(index + 1)} · $${String(value)}`,
    detail: `Day ${String(index + 1)} in full`,
    amount: `$${String(value)}`,
    today: index === 11,
    future: index > 11,
  };
});

function renderHeat(props: Partial<React.ComponentProps<typeof Heat>> = {}) {
  return render(
    <Heat
      cells={CELLS}
      columns={COLUMNS}
      leading={1}
      label="Spending calendar"
      scale={SCALE}
      onSelect={vi.fn()}
      {...props}
    />,
  );
}

describe("Heat", () => {
  it("makes every day that happened a control named by its day and its amount", async () => {
    const onSelect = vi.fn();
    renderHeat({ onSelect });
    const grid = screen.getByRole("group", { name: "Spending calendar" });
    expect(within(grid).getAllByRole("button")).toHaveLength(12);
    await userEvent.click(screen.getByRole("button", { name: "Day 9 · $1000" }));
    expect(onSelect).toHaveBeenCalledWith(8);
  });

  it("draws a day that has not arrived out of reach of pointer and reader", () => {
    renderHeat();
    expect(screen.queryByRole("button", { name: /Day 13/ })).not.toBeInTheDocument();
    expect(screen.getByText("13")).toHaveAttribute("aria-hidden", "true");
  });

  it("pads the first week so the first day lands in its own column", () => {
    const { container } = renderHeat();
    const grid = container.querySelector('[role="group"]');
    expect(grid?.childElementCount).toBe(1 + CELLS.length);
    expect(grid?.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("is one tab stop, and enters on today", async () => {
    renderHeat();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Day 12 · $110" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Day 12 · $110" })).not.toHaveFocus();
  });

  it("walks a day with the horizontal arrows and a week with the vertical ones", async () => {
    renderHeat();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Day 11 · $100" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Day 4 · $0" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Day 11 · $100" })).toHaveFocus();
  });

  it("stops at the ends instead of wrapping, and Home and End jump to them", async () => {
    renderHeat();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("button", { name: "Day 1 · $0" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Day 12 · $110" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "Day 1 · $0" })).toHaveFocus();
  });

  it("reads the pointed day in the line underneath, and the summary when nothing is pointed", async () => {
    renderHeat({ summary: { label: "Day 9 · highest", amount: "$1,000" } });
    expect(screen.getByText("Day 9 · highest")).toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: "Day 9 · $1000" }));
    expect(screen.getByText("Day 9 in full")).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole("button", { name: "Day 9 · $1000" }));
    expect(screen.getByText("Day 9 · highest")).toBeInTheDocument();
  });

  it("paints four steps over the spent days and leaves the empty ones flat", () => {
    renderHeat();
    expect(screen.getByRole("button", { name: "Day 9 · $1000" })).toHaveClass("bg-heat-4");
    expect(screen.getByRole("button", { name: "Day 1 · $0" })).toHaveClass("bg-surface-3");
    expect(screen.getByRole("button", { name: "Day 2 · $10" })).toHaveClass("bg-heat-1");
  });

  it("reads the whole calendar in its name when its cells lead nowhere", () => {
    render(
      <Heat cells={CELLS} columns={COLUMNS} leading={1} label="Spending calendar" scale={SCALE} />,
    );
    const chart = screen.getByRole("img", { name: /Spending calendar: Day 1/ });
    expect(within(chart).queryByRole("button")).not.toBeInTheDocument();
  });
});
