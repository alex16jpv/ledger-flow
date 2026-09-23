import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { withPhoneWidth } from "@/lib/testing/phone";
import { renderWithProviders } from "@/lib/testing/render";

import { Sheet, SheetAction, SheetCancel, useUnsavedGuard } from "./Sheet";

describe("Sheet", () => {
  it("opens as a modal dialog labelled by its title and closes from the button", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet layout="dialog" open onClose={onClose} title="Pick a category">
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
      <Sheet layout="dialog" open onClose={onClose} title="Filters">
        <p>content</p>
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the finger lands outside the sheet, and not when it lands inside (T-75)", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet layout="dialog" open onClose={onClose} title="Add expense">
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
      <Sheet layout="dialog" open onClose={onClose} title="Add expense">
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
      <Sheet layout="dialog" open onClose={onClose} title="Add expense">
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
      <Sheet layout="dialog" open dismissible={false} onClose={onClose} title="Three exits">
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
      <Sheet layout="dialog" open onClose={onOuterClose} title="Add expense">
        <Sheet layout="dialog" open onClose={onInnerClose} title="Account">
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
      <Sheet layout="dialog" open onClose={onOuterClose} title="Add expense">
        <Sheet layout="dialog" open onClose={onInnerClose} title="Account">
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
      <Sheet
        layout="dialog"
        open
        onClose={onClose}
        title="Adjust balance"
        footer={<button>Save</button>}
      >
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
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Are you sure you want to leave?");
    expect(screen.getByRole("button", { name: "Save" }).closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" }).closest("[inert]")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks when the sheet itself is told there is something to lose (T-78)", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet layout="dialog" open unsaved onClose={onClose} title="Add expense">
        <p>content</p>
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Are you sure you want to leave?");
  });

  it("leaves when the question is answered with Leave (T-78)", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet layout="dialog" open onClose={onClose} title="Adjust balance">
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
      <Sheet layout="dialog" open onClose={onClose} title="Adjust balance" footer={<SheetCancel />}>
        <Typed unsaved={false} />
      </Sheet>,
    );

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each([["Close"], ["Cancel"]])(
    "asks before leaving through %s with something typed (T-104)",
    async (name) => {
      const onClose = vi.fn();
      renderWithProviders(
        <Sheet
          layout="dialog"
          open
          onClose={onClose}
          title="Adjust balance"
          footer={<SheetCancel />}
        >
          <Typed unsaved />
        </Sheet>,
      );

      await userEvent.click(screen.getByRole("button", { name }));

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toHaveTextContent("Are you sure you want to leave?");
      expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
      expect(screen.getByRole("button", { name }).closest("[inert]")).not.toBeNull();

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
      <Sheet layout="dialog" open onClose={onClose} title="Account">
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
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    rerender(
      <Sheet layout="dialog" open onClose={onClose} title="Account">
        <Swappable typed={false} />
      </Sheet>,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("takes the next exit when what was worth asking about goes away (T-109)", () => {
    const onClose = vi.fn();
    function Body({ unsaved }: { unsaved: boolean }) {
      useUnsavedGuard(unsaved);
      return <input aria-label="Name" />;
    }
    const { rerender } = renderWithProviders(
      <Sheet layout="dialog" open onClose={onClose} title="Resolve" footer={<button>Save</button>}>
        <Body unsaved />
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    rerender(
      <Sheet layout="dialog" open onClose={onClose} title="Resolve" footer={<button>Save</button>}>
        <Body unsaved={false} />
      </Sheet>,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays closed when open is false", () => {
    renderWithProviders(
      <Sheet layout="dialog" open={false} onClose={vi.fn()} title="Hidden">
        <p>content</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
  });

  it("keeps editing when the finger lands beside the question, not only on its button (T-150)", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet layout="full" open unsaved onClose={onClose} title="Adjust balance">
        <p>content</p>
      </Sheet>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    const backdrop = screen.getByRole("alertdialog").parentElement;
    expect(backdrop).not.toBeNull();
    if (backdrop) await userEvent.click(backdrop);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders its primary as an ordinary button outside a sheet, for the forms a page also shows", () => {
    renderWithProviders(<SheetAction>Create account</SheetAction>);

    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  const footer = (
    <>
      <button type="button">More details</button>
      <SheetAction>Save</SheetAction>
      <SheetCancel />
    </>
  );

  it("keeps the footer under the body on a wide screen, whatever the layout (T-150)", () => {
    renderWithProviders(
      <Sheet layout="full" open onClose={vi.fn()} title="Add" footer={footer}>
        <p>content</p>
      </Sheet>,
    );

    const save = screen.getByRole("button", { name: "Save" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByText("content").compareDocumentPosition(save)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  describe("on a phone (T-150)", () => {
    withPhoneWidth();

    it("fills the screen with a form: the primary up in the bar, Cancel left to the close button", () => {
      renderWithProviders(
        <Sheet layout="full" open onClose={vi.fn()} title="Add" footer={footer}>
          <p>content</p>
        </Sheet>,
      );

      const bar = screen.getByRole("heading", { name: "Add" }).parentElement;
      expect(bar).not.toBeNull();
      expect(bar).toContainElement(screen.getByRole("button", { name: "Save" }));
      expect(bar).toContainElement(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
      expect(
        screen
          .getByText("content")
          .compareDocumentPosition(screen.getByRole("button", { name: "More details" })),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("keeps a centred dialog's footer as it is", () => {
      renderWithProviders(
        <Sheet layout="dialog" open onClose={vi.fn()} title="Archive?" footer={footer}>
          <p>content</p>
        </Sheet>,
      );

      const bar = screen.getByRole("heading", { name: "Archive?" }).parentElement;
      expect(bar).not.toContainElement(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("still asks before leaving a full-screen form, through the close button", async () => {
      const onClose = vi.fn();
      renderWithProviders(
        <Sheet layout="full" open unsaved onClose={onClose} title="Add" footer={footer}>
          <p>content</p>
        </Sheet>,
      );

      await userEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
      expect(screen.getByRole("button", { name: "Save" }).closest("[inert]")).not.toBeNull();
    });

    it("keeps what else the footer says, such as a server error, at the end of the body", () => {
      renderWithProviders(
        <Sheet
          layout="full"
          open
          onClose={vi.fn()}
          title="Pay"
          footer={
            <>
              <p role="alert">The payment was refused.</p>
              <SheetAction>Pay</SheetAction>
              <SheetCancel />
            </>
          }
        >
          <p>content</p>
        </Sheet>,
      );

      const error = screen.getByRole("alert");
      expect(error.parentElement).not.toBeEmptyDOMElement();
      expect(screen.getByText("content").compareDocumentPosition(error)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it("submits the form it names from the bar, outside that form", async () => {
      const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
        event.preventDefault();
      });
      renderWithProviders(
        <Sheet layout="full" open onClose={vi.fn()} title="New account">
          <form id="account" onSubmit={onSubmit}>
            <input aria-label="Name" defaultValue="Cash" />
            <SheetAction type="submit" form="account">
              Create account
            </SheetAction>
          </form>
        </Sheet>,
      );

      const create = screen.getByRole("button", { name: "Create account" });
      expect(create.closest("form")).toBeNull();
      await userEvent.click(create);
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("gives the focus back to the close button that asked", async () => {
      renderWithProviders(
        <Sheet layout="full" open unsaved onClose={vi.fn()} title="Add" footer={footer}>
          <p>content</p>
        </Sheet>,
      );

      await userEvent.click(screen.getByRole("button", { name: "Close" }));
      await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));

      expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    });

    it("fits the area the keyboard leaves, and follows it as it moves", () => {
      const listeners = new Map<string, () => void>();
      const viewport = {
        height: 480,
        offsetTop: 12,
        scale: 1,
        addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
        removeEventListener: (type: string) => listeners.delete(type),
      };
      Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
      try {
        renderWithProviders(
          <Sheet layout="full" open onClose={vi.fn()} title="Add">
            <p>content</p>
          </Sheet>,
        );
        const dialog = screen.getByRole("dialog", { name: "Add" });
        expect(dialog).toHaveStyle({ height: "480px", top: "12px" });

        viewport.height = 300;
        act(() => {
          listeners.get("resize")?.();
        });
        expect(dialog).toHaveStyle({ height: "300px" });

        viewport.scale = 2;
        act(() => {
          listeners.get("resize")?.();
        });
        expect(dialog.style.height).toBe("");
      } finally {
        Reflect.deleteProperty(window, "visualViewport");
      }
    });
  });
});
