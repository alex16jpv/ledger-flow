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

  it("closes when the finger lands outside the sheet, and not when it lands inside (T-75)", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Add expense">
        <p>content</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Add expense" });
    await userEvent.click(screen.getByText("content"));
    expect(onClose).not.toHaveBeenCalled();
    const scrim = dialog.firstElementChild;
    expect(scrim).not.toBeNull();
    if (scrim) await userEvent.click(scrim);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when the press starts on the scrim and ends inside (T-75)", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Add expense">
        <p>content</p>
      </Sheet>,
    );
    const scrim = screen.getByRole("dialog", { name: "Add expense" }).firstElementChild;
    expect(scrim).not.toBeNull();
    if (scrim) {
      fireEvent.pointerDown(scrim);
      fireEvent.pointerUp(screen.getByText("content"));
      fireEvent.click(scrim);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when the press starts inside and ends on the scrim (T-75)", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Add expense">
        <p>content</p>
      </Sheet>,
    );
    const scrim = screen.getByRole("dialog", { name: "Add expense" }).firstElementChild;
    expect(scrim).not.toBeNull();
    fireEvent.pointerDown(screen.getByText("content"));
    if (scrim) {
      fireEvent.pointerUp(scrim);
      fireEvent.click(scrim);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on a tap outside when it is not dismissible", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open dismissible={false} onClose={onClose} title="Three exits">
        <p>choose</p>
      </Sheet>,
    );
    const scrim = screen.getByRole("dialog", { name: "Three exits" }).firstElementChild;
    expect(scrim).not.toBeNull();
    if (scrim) {
      fireEvent.pointerDown(scrim);
      fireEvent.pointerUp(scrim);
      fireEvent.click(scrim);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes only the nested sheet when the finger lands outside it (T-75)", () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onOuterClose} title="Add expense">
        <Sheet open onClose={onInnerClose} title="Account">
          <p>options</p>
        </Sheet>
      </Sheet>,
    );
    const scrim = screen.getByRole("dialog", { name: "Account" }).firstElementChild;
    expect(scrim).not.toBeNull();
    if (scrim) {
      fireEvent.pointerDown(scrim);
      fireEvent.pointerUp(scrim);
      fireEvent.click(scrim);
    }
    expect(onInnerClose).toHaveBeenCalledOnce();
    expect(onOuterClose).not.toHaveBeenCalled();
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
