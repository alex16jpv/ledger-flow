import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ColBars, type Column } from "./ColBars";

const PERIODS: Column[] = [
  { label: "April · $268,000 of $250,000", segments: [{ value: 268, over: true }], cap: 250 },
  { label: "May · $212,000 of $250,000", segments: [{ value: 212 }], cap: 250 },
  {
    label: "June · $356,000 of $300,000, in progress",
    amount: "$356,000",
    segments: [{ value: 356, over: true }],
    cap: 300,
    partial: true,
  },
];

describe("ColBars", () => {
  it("makes every period a control named by what it spent and what it could", async () => {
    const onSelect = vi.fn();
    render(<ColBars columns={PERIODS} label="Spent against the limit" onSelect={onSelect} />);
    const chart = screen.getByRole("group", { name: "Spent against the limit" });
    expect(within(chart).getAllByRole("button")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /April/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("reads every column itself where a column leads nowhere", () => {
    render(<ColBars columns={PERIODS} label="Spent against the limit" />);
    expect(
      screen.getByRole("img", {
        name: "Spent against the limit: April · $268,000 of $250,000, May · $212,000 of $250,000, June · $356,000 of $300,000, in progress",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("enters on the period on screen and walks the others with the arrows", async () => {
    render(<ColBars columns={PERIODS} label="Spent against the limit" onSelect={vi.fn()} />);
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

  it("caps each column with its own limit, because an adjusted period does not share the base", () => {
    const { container } = render(
      <ColBars columns={PERIODS} label="Spent against the limit" onSelect={vi.fn()} />,
    );
    const caps = [...container.querySelectorAll("span.border-dashed")].map(
      (cap) => (cap as HTMLElement).style.bottom,
    );
    // The tallest column is 356, so 250 and 300 land at their own share of it.
    expect(caps).toEqual(["70.2247191011236%", "70.2247191011236%", "84.26966292134831%"]);
  });

  it("says which slot the pointer is on, and the summary when it is on none", async () => {
    render(
      <ColBars
        columns={PERIODS}
        label="Spent against the limit"
        onSelect={vi.fn()}
        summary={{ label: "Three of the last six went over" }}
      />,
    );
    expect(screen.getByText("Three of the last six went over")).toBeVisible();
    await userEvent.hover(screen.getByRole("button", { name: /June/ }));
    expect(screen.getByText("$356,000")).toBeVisible();
  });
});
