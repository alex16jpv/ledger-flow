import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("opens as a modal dialog labelled by its title and closes from the button", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Pick a category">
        <p>content</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Pick a category" });
    expect(dialog).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape (cancel event)", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Filters">
        <p>content</p>
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps an outer sheet open when a nested sheet closes or cancels", () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onOuterClose} title="Add expense">
        <Sheet open onClose={onInnerClose} title="Account">
          <p>options</p>
        </Sheet>
      </Sheet>,
    );
    const inner = screen.getByRole("dialog", { name: "Account" });
    fireEvent(inner, new Event("cancel", { cancelable: true }));
    fireEvent(inner, new Event("close"));
    expect(onInnerClose).toHaveBeenCalledTimes(2);
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("stays closed when open is false", () => {
    renderWithProviders(
      <Sheet open={false} onClose={vi.fn()} title="Hidden">
        <p>content</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
  });
});
