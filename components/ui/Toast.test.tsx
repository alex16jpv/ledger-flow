import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider, useToast } from "./Toast";

function Trigger({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button
      onClick={() => {
        toast.show({ message: "Transaction saved", action: { label: "Undo", onClick: onUndo } });
      }}
    >
      save
    </button>
  );
}

describe("Toast", () => {
  it("announces politely, runs the action once and auto-dismisses after 5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Transaction saved");
    expect(screen.getByRole("status").parentElement).toHaveAttribute("aria-live", "polite");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "save" }));
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.queryByRole("status")).toBeNull();
    vi.useRealTimers();
  });
});
