import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { DateTimeField } from "./DateTimeField";

describe("DateTimeField", () => {
  it("reports the chosen day and clears the time back to null", async () => {
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
    const date = screen.getByLabelText("Date");
    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveAttribute("max", "2026-09-23");
    fireEvent.change(date, { target: { value: "2026-09-20" } });
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-09-20", time: "18:10" });
    fireEvent.change(date, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledTimes(1);

    await userEvent.clear(screen.getByLabelText(/Time/));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-09-22", time: null });
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
    expect(screen.getByLabelText("Date")).toHaveAttribute("aria-invalid", "true");
  });
});
