import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GBars, type Pair } from "./GBars";

const MONTHS: Pair[] = [
  { label: "July · $4,200,000 in, $2,110,000 out", income: 4_200_000, spending: 2_110_000 },
  { label: "August · $4,200,000 in, $1,855,000 out", income: 4_200_000, spending: 1_855_000 },
  {
    label: "September · $4,200,000 in, $815,900 out, in progress",
    amount: "$815,900",
    income: 4_200_000,
    spending: 815_900,
    partial: true,
  },
];

describe("GBars", () => {
  it("makes every month a control named by what came in and what went out", async () => {
    const onSelect = vi.fn();
    render(<GBars pairs={MONTHS} label="Income against spending" onSelect={onSelect} />);
    const chart = screen.getByRole("group", { name: "Income against spending" });
    expect(within(chart).getAllByRole("button")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /July/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("reads every month itself where a month leads nowhere", () => {
    render(<GBars pairs={MONTHS} label="Income against spending" />);
    expect(
      screen.getByRole("img", {
        name: "Income against spending: July · $4,200,000 in, $2,110,000 out, August · $4,200,000 in, $1,855,000 out, September · $4,200,000 in, $815,900 out, in progress",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("enters on the month on screen and walks the others with the arrows", async () => {
    render(<GBars pairs={MONTHS} label="Income against spending" onSelect={vi.fn()} />);
    const slots = screen.getAllByRole("button");
    await userEvent.tab();
    expect(slots[2]).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(slots[0]).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(slots[2]).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(slots[0]).toHaveFocus();
  });

  it("scales both series against the tallest bar of the chart", () => {
    const { container } = render(
      <GBars pairs={MONTHS} label="Income against spending" onSelect={vi.fn()} />,
    );
    const heights = [...container.querySelectorAll("i")].map((bar) => bar.style.height);
    expect(heights[0]).toBe("100%");
    expect(heights[1]).toBe(`${String((2_110_000 / 4_200_000) * 100)}%`);
  });

  it("hatches the month still running, and only it", () => {
    const { container } = render(<GBars pairs={MONTHS} label="Income against spending" />);
    const hatched = [...container.querySelectorAll("i")].filter((bar) =>
      bar.className.includes("repeating-linear-gradient"),
    );
    expect(hatched).toHaveLength(2);
  });

  it("says which month the pointer is on, and the summary when it is on none", async () => {
    render(
      <GBars
        pairs={MONTHS}
        label="Income against spending"
        onSelect={vi.fn()}
        summary={{ label: "Six months, one of them still running" }}
      />,
    );
    expect(screen.getByText("Six months, one of them still running")).toBeVisible();
    await userEvent.hover(screen.getByRole("button", { name: /September/ }));
    expect(screen.getByText("$815,900")).toBeVisible();
  });
});
