import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { EXPAND_DRAG_PX, Sheet, SheetCancel, useUnsavedGuard } from "./Sheet";

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

  function Typed({ unsaved }: { unsaved: boolean }) {
    useUnsavedGuard(unsaved);
    return <input aria-label="Amount" defaultValue="12500" />;
  }

  it("asks before leaving a form with something typed, and keeps it open (T-78)", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Adjust balance" footer={<button>Save</button>}>
        <Typed unsaved />
      </Sheet>,
    );
    const scrim = screen.getByRole("dialog", { name: "Adjust balance" }).firstElementChild;
    expect(scrim).not.toBeNull();
    if (scrim) {
      fireEvent.pointerDown(scrim);
      fireEvent.pointerUp(scrim);
      fireEvent.click(scrim);
    }
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Are you sure you want to leave?");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks when the sheet itself is told there is something to lose (T-78)", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open unsaved onClose={onClose} title="Add expense">
        <p>content</p>
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Are you sure you want to leave?");
  });

  it("leaves when the question is answered with Leave (T-78)", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Adjust balance">
        <Typed unsaved />
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not ask when the form has nothing typed, whichever exit is used (T-104)", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open onClose={onClose} title="Adjust balance" footer={<SheetCancel />}>
        <Typed unsaved={false} />
      </Sheet>,
    );

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([["Close"], ["Cancel"]])(
    "asks before leaving through %s with something typed (T-104)",
    async (name) => {
      const onClose = vi.fn();
      renderWithProviders(
        <Sheet open onClose={onClose} title="Adjust balance" footer={<SheetCancel />}>
          <Typed unsaved />
        </Sheet>,
      );

      await userEvent.click(screen.getByRole("button", { name }));

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("Are you sure you want to leave?");
      expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
      // The footer is replaced by the question, so the exit that asked is no longer there to press.
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
      expect(screen.getByRole("button", { name })).toHaveFocus();

      await userEvent.click(screen.getByRole("button", { name }));
      await userEvent.click(screen.getByRole("button", { name: "Leave" }));
      expect(onClose).toHaveBeenCalledOnce();
    },
  );

  it("refuses to render a Cancel outside a sheet, rather than one that closes nothing (T-104)", () => {
    const noise = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderWithProviders(<SheetCancel />)).toThrow(/inside a Sheet/);
    noise.mockRestore();
  });

  it("drops the question when what reported it goes away (T-78)", () => {
    function Swappable({ typed }: { typed: boolean }) {
      return typed ? <Typed unsaved /> : <p>list</p>;
    }
    const onClose = vi.fn();
    const { rerender } = renderWithProviders(
      <Sheet open onClose={onClose} title="Account">
        <Swappable typed />
      </Sheet>,
    );
    const scrim = screen.getByRole("dialog", { name: "Account" }).firstElementChild;
    expect(scrim).not.toBeNull();
    if (scrim) {
      fireEvent.pointerDown(scrim);
      fireEvent.pointerUp(scrim);
      fireEvent.click(scrim);
    }
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(
      <Sheet open onClose={onClose} title="Account">
        <Swappable typed={false} />
      </Sheet>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes the next exit when what was worth asking about goes away (T-109)", () => {
    const onClose = vi.fn();
    function Body({ unsaved }: { unsaved: boolean }) {
      useUnsavedGuard(unsaved);
      return <input aria-label="Name" />;
    }
    const { rerender } = renderWithProviders(
      <Sheet open onClose={onClose} title="Resolve" footer={<button>Save</button>}>
        <Body unsaved />
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <Sheet open onClose={onClose} title="Resolve" footer={<button>Save</button>}>
        <Body unsaved={false} />
      </Sheet>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays closed when open is false", () => {
    renderWithProviders(
      <Sheet open={false} onClose={vi.fn()} title="Hidden">
        <p>content</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
  });

  // T-75: the bar was drawn on all 38 sheets and did nothing. In quick add it now opens the full form.
  describe("the bar on top", () => {
    const view = (onExpand: () => void) => {
      renderWithProviders(
        <Sheet
          open
          onClose={vi.fn()}
          title="Add"
          onExpand={onExpand}
          expandLabel="Open the full form"
        >
          <p>content</p>
        </Sheet>,
      );
    };

    it("is decoration in a sheet that has nothing to open", () => {
      renderWithProviders(
        <Sheet open onClose={vi.fn()} title="Add">
          <p>content</p>
        </Sheet>,
      );

      expect(screen.queryByRole("button", { name: "Open the full form" })).not.toBeInTheDocument();
    });

    it("opens the full form on a tap", async () => {
      const onExpand = vi.fn();
      view(onExpand);

      await userEvent.click(screen.getByRole("button", { name: "Open the full form" }));

      expect(onExpand).toHaveBeenCalledOnce();
    });

    it("opens it once on a drag upwards, and reads a 2px wobble as the tap it is", () => {
      const onExpand = vi.fn();
      view(onExpand);
      const bar = screen.getByRole("button", { name: "Open the full form" });

      fireEvent.pointerDown(bar, { clientY: 200 });
      fireEvent.pointerUp(bar, { clientY: 200 - EXPAND_DRAG_PX });
      fireEvent.click(bar, { detail: 1 });
      expect(onExpand).toHaveBeenCalledOnce();

      fireEvent.pointerDown(bar, { clientY: 200 });
      fireEvent.pointerUp(bar, { clientY: 198 });
      fireEvent.click(bar, { detail: 1 });
      expect(onExpand).toHaveBeenCalledTimes(2);
    });

    // The bar is the usual pull-down-to-dismiss affordance: a downward drag must not open anything,
    // and Chromium sends the compatibility click afterwards, so the handler has to swallow it too.
    it("does not open it when the drag goes down, click and all", () => {
      const onExpand = vi.fn();
      view(onExpand);
      const bar = screen.getByRole("button", { name: "Open the full form" });

      fireEvent.pointerDown(bar, { clientY: 200 });
      fireEvent.pointerUp(bar, { clientY: 260 });
      fireEvent.click(bar, { detail: 1 });

      expect(onExpand).not.toHaveBeenCalled();
    });

    // A long drag gets no click at all, so a flag left standing would eat the next Enter.
    it("still answers the keyboard after a drag that the browser never clicked", async () => {
      const onExpand = vi.fn();
      view(onExpand);
      const bar = screen.getByRole("button", { name: "Open the full form" });

      fireEvent.pointerDown(bar, { clientY: 200 });
      fireEvent.pointerUp(bar, { clientY: 140 });
      expect(onExpand).toHaveBeenCalledOnce();

      bar.focus();
      await userEvent.keyboard("{Enter}");
      expect(onExpand).toHaveBeenCalledTimes(2);
    });

    // T-78's question leaves only two answers; the bar is not a third way out of it.
    it("cannot be used while the sheet is asking about unsaved work", async () => {
      const onExpand = vi.fn();
      renderWithProviders(
        <Sheet
          open
          onClose={vi.fn()}
          title="Add"
          unsaved
          onExpand={onExpand}
          expandLabel="Open the full form"
        >
          <p>content</p>
        </Sheet>,
      );
      const dialog = screen.getByRole("dialog", { name: "Add" });
      const scrim = dialog.firstElementChild;
      expect(scrim).not.toBeNull();
      if (!scrim) return;
      await userEvent.click(scrim);
      expect(screen.getByRole("alert")).toBeInTheDocument();

      expect(screen.getByRole("button", { name: "Open the full form" })).toHaveAttribute("inert");
      expect(onExpand).not.toHaveBeenCalled();
    });

    it("forgets a cancelled pointer instead of measuring the next one against it", () => {
      const onExpand = vi.fn();
      view(onExpand);
      const bar = screen.getByRole("button", { name: "Open the full form" });

      fireEvent.pointerDown(bar, { clientY: 200 });
      fireEvent.pointerCancel(bar);
      fireEvent.pointerUp(bar, { clientY: 100 });

      expect(onExpand).not.toHaveBeenCalled();
    });
  });
});
