import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { type Bar, Bars } from "./Bars";

const DAYS: Bar[] = [
  { value: 0, label: "Tue, Sep 1 · $0", detail: "Tuesday, September 1", amount: "$0" },
  { value: 50, label: "Wed, Sep 2 · $500", detail: "Wednesday, September 2", amount: "$500" },
  {
    value: 100,
    label: "Thu, Sep 3 · $1,000",
    detail: "Thursday, September 3",
    amount: "$1,000",
    today: true,
  },
  { value: 0, label: "Fri, Sep 4", future: true },
];

const SUMMARY = { label: "Thursday, September 3 · highest", amount: "$1,000" };

describe("Bars", () => {
  it("makes every slot that happened a control named by its day and its amount", async () => {
    const onSelect = vi.fn();
    render(<Bars bars={DAYS} label="Spending per day" onSelect={onSelect} />);
    const chart = screen.getByRole("group", { name: "Spending per day" });
    expect(within(chart).getAllByRole("button")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Thu, Sep 3 · $1,000" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("draws a day that has not arrived as a rule, out of reach of pointer and reader", () => {
    const { container } = render(<Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Sep 4/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Fri, Sep 4")).not.toBeInTheDocument();
    const rules = container.querySelectorAll("i.h-px");
    expect(rules).toHaveLength(1);
    expect(rules[0]?.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('[role="group"]')?.childElementCount).toBe(DAYS.length);
  });

  it("opens the focused slot with Enter and with Space", async () => {
    const onSelect = vi.fn();
    render(<Bars bars={DAYS} label="Spending per day" onSelect={onSelect} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onSelect.mock.calls).toEqual([[2], [2]]);
  });

  it("stops at the ends instead of wrapping, and takes the vertical arrows too", async () => {
    render(<Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} />);
    const slots = screen.getAllByRole("button");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(slots[2]).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(slots[0]).toHaveFocus();
  });

  it("aligns the bubble to the end a slot is near, so it never leaves the card", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      value: index,
      label: `Day ${String(index + 1)}`,
    }));
    const { container } = render(<Bars bars={many} label="Spending per day" onSelect={vi.fn()} />);
    const tips = [...container.querySelectorAll('[role="group"] > span')].map(
      (slot) => slot.className,
    );
    expect(tips[0]).toContain("group/tip");
    const bubble = (index: number) =>
      container.querySelectorAll('[role="group"] > span')[index]?.querySelector("span")
        ?.className ?? "";
    expect(bubble(0)).toContain("left-0");
    expect(bubble(15)).toContain("-translate-x-1/2");
    expect(bubble(29)).toContain("right-0");
  });

  it("keeps the line in place and moves it back to the focused slot when the pointer leaves", async () => {
    render(<Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} summary={SUMMARY} />);
    await userEvent.tab();
    expect(screen.getByText("Thursday, September 3")).toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: "Wed, Sep 2 · $500" }));
    expect(screen.getByText("Wednesday, September 2")).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole("button", { name: "Wed, Sep 2 · $500" }));
    expect(screen.getByText("Thursday, September 3")).toBeInTheDocument();
  });

  it("takes the focus to the nearest slot left when the focused day stops having arrived", async () => {
    const { rerender } = render(
      <Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} summary={SUMMARY} />,
    );
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Thu, Sep 3 · $1,000" })).toHaveFocus();
    const shortened = DAYS.map((bar, index) =>
      index === 2 ? { ...bar, today: false, future: true } : bar,
    );
    rerender(
      <Bars bars={shortened} label="Spending per day" onSelect={vi.fn()} summary={SUMMARY} />,
    );
    expect(screen.getByRole("button", { name: "Wed, Sep 2 · $500" })).toHaveFocus();
  });

  it("keeps the line even with nothing to say, so the first hover does not move the page", () => {
    const { container } = render(<Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("is one tab stop whose arrows, Home and End move between slots", async () => {
    render(
      <div>
        <button type="button">Before</button>
        <Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} />
      </div>,
    );
    const slots = screen.getAllByRole("button").slice(1);
    expect(slots.filter((slot) => slot.tabIndex === 0)).toHaveLength(1);
    await userEvent.tab();
    await userEvent.tab();
    expect(slots[2]).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(slots[1]).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(slots[0]).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(slots[2]).toHaveFocus();
    await userEvent.tab();
    expect(slots.some((slot) => slot === document.activeElement)).toBe(false);
  });

  it("reads the pointed slot in the line underneath and falls back to the summary", async () => {
    render(<Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} summary={SUMMARY} />);
    expect(screen.getByText("Thursday, September 3 · highest")).toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: "Wed, Sep 2 · $500" }));
    expect(screen.getByText("Wednesday, September 2")).toBeInTheDocument();
    expect(screen.getByText("$500")).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole("button", { name: "Wed, Sep 2 · $500" }));
    expect(screen.getByText("Thursday, September 3 · highest")).toBeInTheDocument();
  });

  it("moves the line with the keyboard, so focus and pointer read the same", async () => {
    render(<Bars bars={DAYS} label="Spending per day" onSelect={vi.fn()} summary={SUMMARY} />);
    await userEvent.tab();
    expect(screen.getByText("Thursday, September 3")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText("Wednesday, September 2")).toBeInTheDocument();
  });

  it("is one image reading every slot where the slots lead nowhere", () => {
    render(<Bars bars={DAYS} label="Average per weekday" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.getByRole("img", {
        name: "Average per weekday: Tue, Sep 1 · $0, Wed, Sep 2 · $500, Thu, Sep 3 · $1,000",
      }),
    ).toBeInTheDocument();
  });
});
