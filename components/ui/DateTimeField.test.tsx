import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { DateField, DateTimeField } from "./DateTimeField";

const openDate = async () => {
  await userEvent.click(screen.getByRole("button", { name: /Date/ }));
  return screen.getByRole("dialog");
};

describe("the date and time fields", () => {
  it("opens a calendar of its own, not the browser's, and reports the day on Done", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DateTimeField
        value={{ date: "2026-09-22", time: "18:10" }}
        onChange={onChange}
        dateLabel="Date"
        timeLabel="Time"
        max="2026-09-23"
      />,
    );

    const sheet = await openDate();
    await userEvent.click(within(sheet).getByRole("gridcell", { name: /September 20/ }));
    // Nothing is reported until Done: the sheet is a decision of its own.
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-09-20", time: "18:10" });
  });

  // 7.28: the server refuses more than 24 h ahead, so those days are not offered at all.
  it("greys out the days past the ceiling and stops the month from going further", async () => {
    renderWithProviders(
      <DateTimeField
        value={{ date: "2026-09-22", time: "18:10" }}
        onChange={vi.fn()}
        dateLabel="Date"
        timeLabel="Time"
        max="2026-09-23"
        dateNote="Days after tomorrow are not available."
      />,
    );

    const sheet = await openDate();
    expect(within(sheet).getByRole("gridcell", { name: /September 23/ })).toBeEnabled();
    expect(within(sheet).getByRole("gridcell", { name: /September 24/ })).toBeDisabled();
    expect(within(sheet).getByRole("button", { name: "Next month" })).toBeDisabled();
    expect(within(sheet).getByText("Days after tomorrow are not available.")).toBeVisible();
    // And it says where the day it saves belongs.
    expect(within(sheet).getByText(/America\/Bogota/)).toBeVisible();
  });

  it("moves by keyboard, a day with the arrows and a month with PageUp", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DateTimeField
        value={{ date: "2026-09-22", time: null }}
        onChange={onChange}
        dateLabel="Date"
        timeLabel="Time"
      />,
    );

    const sheet = await openDate();
    const grid = within(sheet).getByRole("grid", { name: "September 2026" });
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    fireEvent.keyDown(grid, { key: "ArrowUp" });
    fireEvent.keyDown(grid, { key: "PageUp" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));

    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-08-14", time: null });
  });

  it("cancels without keeping what was chosen", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DateTimeField
        value={{ date: "2026-09-22", time: null }}
        onChange={onChange}
        dateLabel="Date"
        timeLabel="Time"
      />,
    );

    let sheet = await openDate();
    await userEvent.click(within(sheet).getByRole("gridcell", { name: /September 10/ }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();

    sheet = await openDate();
    expect(within(sheet).getByRole("gridcell", { name: /September 22/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("picks the time from a wheel of hours and minutes", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DateTimeField
        value={{ date: "2026-09-22", time: "18:10" }}
        onChange={onChange}
        dateLabel="Date"
        timeLabel="Time"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Time/ }));
    const sheet = screen.getByRole("dialog");
    // English reads time in twelve hours, so the wheel has the third column.
    const hours = within(sheet).getByRole("listbox", { name: "Hours" });
    await userEvent.click(within(hours).getByRole("option", { name: "9" }));
    const minutes = within(sheet).getByRole("listbox", { name: "Minutes" });
    await userEvent.click(within(minutes).getByRole("option", { name: "45" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));

    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-09-22", time: "21:45" });
  });

  it("shows the date error under the date control", () => {
    renderWithProviders(
      <DateTimeField
        value={{ date: "2026-09-22", time: null }}
        onChange={vi.fn()}
        dateLabel="Date"
        timeLabel="Time"
        dateError="That day is too far ahead."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("That day is too far ahead.");
  });

  // The filters range and the budget's dates ask for a day and nothing else (§8.5, §8.8).
  it("works on its own, for a day with no time beside it", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DateField value="2026-09-22" onChange={onChange} label="Effective from" />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Effective from/ }));
    const sheet = screen.getByRole("dialog");
    await userEvent.click(within(sheet).getByRole("gridcell", { name: /September 30/ }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));

    expect(onChange).toHaveBeenLastCalledWith("2026-09-30");
    expect(screen.queryByRole("button", { name: /Time/ })).not.toBeInTheDocument();
  });
});
