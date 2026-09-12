import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { DaySlot } from "@/lib/charts/days";
import { renderWithProviders } from "@/lib/testing/render";

import { DayBars } from "./DayBars";

const DAYS: DaySlot[] = [
  { key: "2026-09-10", value: 0, count: 0 },
  { key: "2026-09-11", value: 214_000, count: 3, today: true },
  { key: "2026-09-12", value: 0, future: true },
];

describe("DayBars", () => {
  it("names each slot with its day and its amount and opens the day behind it", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<DayBars days={DAYS} label="Spending per day" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Fri, Sep 11 · $214,000" }));
    expect(onOpen).toHaveBeenCalledWith("2026-09-11");
  });

  it("repeats the day, its transactions and its amount in the line underneath", async () => {
    renderWithProviders(<DayBars days={DAYS} label="Spending per day" onOpen={vi.fn()} />);
    await userEvent.hover(screen.getByRole("button", { name: "Fri, Sep 11 · $214,000" }));
    expect(screen.getByText("Friday, September 11 · 3 transactions")).toBeInTheDocument();
  });

  it("says only the day where the slots carry no count, as Home's plate does", async () => {
    const noCounts: DaySlot[] = DAYS.map((day) => ({ ...day, count: undefined }));
    renderWithProviders(<DayBars days={noCounts} label="Spending per day" onOpen={vi.fn()} />);
    await userEvent.hover(screen.getByRole("button", { name: "Fri, Sep 11 · $214,000" }));
    expect(screen.getByText("Friday, September 11")).toBeInTheDocument();
  });

  it("names the day in the user's zone, not at noon UTC", async () => {
    renderWithProviders(<DayBars days={DAYS} label="Spending per day" onOpen={vi.fn()} />, {
      timeZone: "Pacific/Kiritimati",
    });
    expect(screen.getByRole("button", { name: "Fri, Sep 11 · $214,000" })).toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: "Fri, Sep 11 · $214,000" }));
    expect(screen.getByText("Friday, September 11 · 3 transactions")).toBeInTheDocument();
  });
});
