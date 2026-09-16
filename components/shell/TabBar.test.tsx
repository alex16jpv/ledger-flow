import { act, fireEvent, screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { HOLD_TO_CHAIN_MS, TabBar } from "./TabBar";

let pathname = "/home";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/home";
});

describe("TabBar add button", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a single capture on click and a chained one after holding", () => {
    const onAdd = vi.fn();
    renderWithProviders(
      <TabBar pendingCount={0} moreOpen={false} onAdd={onAdd} onMore={vi.fn()} />,
    );
    const fab = screen.getByRole("button", { name: "Add" });

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

// T-72: five slots, and Accounts is no longer one of them — it lives behind More.
describe("TabBar destinations", () => {
  it("ends in More, which opens a dialog instead of navigating", () => {
    const onMore = vi.fn();
    renderWithProviders(
      <TabBar pendingCount={0} moreOpen={false} onAdd={vi.fn()} onMore={onMore} />,
    );

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/home",
      "/transactions",
      "/budgets",
    ]);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-haspopup", "dialog");
    expect(more).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(more);
    expect(onMore).toHaveBeenCalledOnce();
  });

  it("marks More while what it opens is showing", () => {
    renderWithProviders(<TabBar pendingCount={0} moreOpen onAdd={vi.fn()} onMore={vi.fn()} />);

    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "true");
  });

  // The bar lost four destinations to More, so More is where the app has to say you are on one.
  it.each(["/accounts", "/stats", "/stats/trends", "/categories", "/settings"])(
    "marks More as the current page on %s",
    (where) => {
      pathname = where;
      renderWithProviders(
        <TabBar pendingCount={0} moreOpen={false} onAdd={vi.fn()} onMore={vi.fn()} />,
      );

      expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "page");
    },
  );

  it("does not mark More on a screen the bar itself holds", () => {
    pathname = "/budgets";
    renderWithProviders(
      <TabBar pendingCount={0} moreOpen={false} onAdd={vi.fn()} onMore={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "More" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Budgets" })).toHaveAttribute("aria-current", "page");
  });
});
