import { act, fireEvent, screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { HOLD_TO_CHAIN_MS, TabBar } from "./TabBar";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/home",
}));

describe("TabBar add button", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a single capture on click and a chained one after holding", () => {
    const onAdd = vi.fn();
    renderWithProviders(<TabBar pendingCount={0} onAdd={onAdd} />);
    const fab = screen.getByRole("button", { name: "Add expense" });

    fireEvent.pointerDown(fab);
    fireEvent.pointerUp(fab);
    fireEvent.click(fab);
    expect(onAdd).toHaveBeenLastCalledWith({ chain: false });

    fireEvent.pointerDown(fab);
    act(() => {
      vi.advanceTimersByTime(HOLD_TO_CHAIN_MS);
    });
    fireEvent.pointerUp(fab);
    fireEvent.click(fab);
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onAdd).toHaveBeenLastCalledWith({ chain: true });
  });
});
