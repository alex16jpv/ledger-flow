import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { DaySlot } from "@/lib/charts/days";
import { renderWithProviders } from "@/lib/testing/render";

import { DayHeat } from "./DayHeat";

// September 2026 opens on a Tuesday, so a Monday week needs one pad and a Sunday week two.
const DAYS: DaySlot[] = [
  { key: "2026-09-01", value: 0, count: 0 },
  { key: "2026-09-02", value: 12_500, count: 1 },
  { key: "2026-09-03", value: 214_000, count: 3, today: true },
  { key: "2026-09-04", value: 0, future: true },
];

describe("DayHeat", () => {
  it("names each cell with its day and its amount and opens the day behind it", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<DayHeat days={DAYS} label="Per day" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Thu, Sep 3 · $214,000" }));
    expect(onOpen).toHaveBeenCalledWith("2026-09-03");
  });

  it("paints the day of the month inside the cell", () => {
    renderWithProviders(<DayHeat days={DAYS} label="Per day" onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Sep 2/ })).toHaveTextContent("2");
  });

  it("starts the week where the locale starts it, and pads up to the first day", () => {
    const { container } = renderWithProviders(
      <DayHeat days={DAYS} label="Per day" onOpen={vi.fn()} />,
    );
    const header = container.querySelector('[aria-hidden="true"].grid');
    expect(header?.firstElementChild).toHaveTextContent("Sun");
    const grid = container.querySelector('[role="group"]');
    const pads = [...(grid?.children ?? [])].filter((node) => node.textContent === "");
    expect(pads).toHaveLength(2);
  });

  it("repeats the day, its transactions and its amount in the line underneath", async () => {
    renderWithProviders(<DayHeat days={DAYS} label="Per day" onOpen={vi.fn()} />);
    await userEvent.hover(screen.getByRole("button", { name: "Thu, Sep 3 · $214,000" }));
    expect(screen.getByText("Thursday, September 3 · 3 transactions")).toBeInTheDocument();
  });

  it("names the day in the user's zone, not at noon UTC", () => {
    renderWithProviders(<DayHeat days={DAYS} label="Per day" onOpen={vi.fn()} />, {
      timeZone: "Pacific/Kiritimati",
    });
    expect(screen.getByRole("button", { name: "Thu, Sep 3 · $214,000" })).toBeInTheDocument();
  });

  it("carries the Less and More scale the four steps need to be read", () => {
    const { container } = renderWithProviders(
      <DayHeat days={DAYS} label="Per day" onOpen={vi.fn()} />,
    );
    const scale = container.querySelector(".flex.items-center.gap-1");
    expect(within(scale as HTMLElement).getByText("Less")).toBeInTheDocument();
    expect(within(scale as HTMLElement).getByText("More")).toBeInTheDocument();
  });
});
