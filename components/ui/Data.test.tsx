import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { AccountCard } from "./AccountCard";
import { PeriodNav } from "./PeriodNav";
import { DayHeader, List, Row, RowBody, RowMeta, RowRight, RowTitle } from "./Row";
import { Stat } from "./Stat";
import { SwatchGrid } from "./Swatch";

describe("Row", () => {
  it("separates metadata with decorative dots", () => {
    render(
      <List>
        <DayHeader label="Today" total="−$9,800" />
        <Row pending>
          <RowBody>
            <RowTitle>
              <span>Pergamino Coffee</span>
            </RowTitle>
            <RowMeta items={["7:55", "Cash"]} />
          </RowBody>
          <RowRight sub="#coffee">−$9,800</RowRight>
        </Row>
      </List>,
    );
    expect(screen.getByText("Pergamino Coffee")).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(screen.getByText("#coffee")).toBeInTheDocument();
  });
});

describe("Stat", () => {
  it("renders delta direction", () => {
    render(
      <Stat
        label="Total balance"
        value="$11,258,600"
        delta={{ direction: "up", label: "4 accounts" }}
      />,
    );
    expect(screen.getByText("4 accounts").className).toContain("text-income");
  });
});

describe("AccountCard and PeriodNav", () => {
  it("shows the main badge and disables next on the current period", async () => {
    const onNext = vi.fn();
    render(
      <div>
        <AccountCard
          name="Bancolombia"
          typeLabel="Bank account"
          balance="$3,420,500"
          color="BLUE"
          mainLabel="Main"
        />
        <PeriodNav
          label="September 2026"
          onPrevious={vi.fn()}
          onNext={onNext}
          previousLabel="Previous month"
          nextLabel="Next month"
          nextDisabled
        />
      </div>,
    );
    expect(screen.getByText("Main")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Next month" });
    expect(next).toBeDisabled();
    await userEvent.click(next);
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe("SwatchGrid", () => {
  it("renders 16 pressable swatches named after their token", async () => {
    const onChange = vi.fn();
    renderWithProviders(<SwatchGrid value="BLUE" onChange={onChange} label="Color" />);
    expect(screen.getAllByRole("button")).toHaveLength(16);
    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Teal" }));
    expect(onChange).toHaveBeenCalledWith("TEAL");
  });
});
