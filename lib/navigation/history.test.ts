import { render, renderHook } from "@testing-library/react";
import { createElement } from "react";

import {
  canGoBack,
  HistoryTracker,
  recordNavigation,
  resetHistoryForTests,
  stepsOutOf,
  useLeaveNavigation,
} from "./history";

const replace = vi.fn();
let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  resetHistoryForTests();
  replace.mockReset();
});

describe("in-app history", () => {
  it("pushes new entries and knows when there is somewhere to go back to", () => {
    recordNavigation("/accounts", 3, false);
    expect(canGoBack()).toBe(false);
    recordNavigation("/accounts/a1", 4, false);
    expect(canGoBack()).toBe(true);
  });

  it("treats a same-length change as a replace and a popstate as a pop", () => {
    recordNavigation("/transactions", 3, false);
    recordNavigation("/transactions?type=EXPENSE", 3, false);
    expect(canGoBack()).toBe(false);
    recordNavigation("/transactions/t1", 4, false);
    expect(canGoBack()).toBe(true);
    recordNavigation("/transactions?type=EXPENSE", 4, true);
    expect(canGoBack()).toBe(false);
  });

  it("ignores a repeated url", () => {
    recordNavigation("/budgets", 2, false);
    recordNavigation("/budgets", 2, false);
    expect(canGoBack()).toBe(false);
  });
});

describe("leaving a movement's pages [T-265]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  const leave = (path: string) => {
    renderHook(() => useLeaveNavigation()).result.current(path, "/transactions");
  };

  it("counts the steps back to the screen that opened them, with or without a locale", () => {
    recordNavigation("/es/accounts/a1", 2, false);
    recordNavigation("/es/transactions/t1", 3, false);
    recordNavigation("/es/transactions/t1/edit", 4, false);
    expect(stepsOutOf("/transactions/t1")).toBe(2);
    expect(stepsOutOf("/transactions/t1/edit")).toBe(1);
  });

  it("does not take another movement whose id ends the same for this one", () => {
    recordNavigation("/transactions/xt1", 2, false);
    recordNavigation("/transactions/t1", 3, false);
    expect(stepsOutOf("/transactions/t1")).toBe(1);
  });

  it("keeps an origin with filters, which is outside the movement", () => {
    recordNavigation("/transactions?type=EXPENSE", 2, false);
    recordNavigation("/transactions/t1", 3, false);
    expect(stepsOutOf("/transactions/t1")).toBe(1);
  });

  it("keeps the first screen when a movement opens after going back from another", () => {
    recordNavigation("/home", 2, false);
    recordNavigation("/transactions/t1", 3, false);
    recordNavigation("/home", 3, false);
    recordNavigation("/transactions/t2", 3, false);
    recordNavigation("/transactions/t2/edit", 4, false);
    expect(stepsOutOf("/transactions/t2")).toBe(2);
    expect(canGoBack()).toBe(true);
  });

  it("still reads a filter changed after going back as a replace", () => {
    recordNavigation("/transactions", 2, false);
    recordNavigation("/transactions/t1", 3, false);
    recordNavigation("/transactions", 3, false);
    recordNavigation("/transactions?type=EXPENSE", 3, false);
    expect(canGoBack()).toBe(false);
  });

  it("has nowhere to go when every entry of ours is one of them", () => {
    recordNavigation("/transactions/t1/edit", 2, false);
    expect(stepsOutOf("/transactions/t1")).toBe(0);
  });

  const browserList = (paths: string[], index: number, loadedAt = 0) => {
    vi.stubGlobal("navigation", {
      currentEntry: { index },
      entries: () =>
        paths.map((path, at) => ({ url: `https://app.test${path}`, sameDocument: at >= loadedAt })),
    });
  };

  it("trusts the browser's own list where it has the Navigation API", () => {
    recordNavigation("/transactions/t1/edit", 2, false);
    browserList(
      ["/home", "/accounts/a1", "/transactions/t1", "/transactions/t1/edit", "/budgets"],
      3,
    );
    expect(stepsOutOf("/transactions/t1")).toBe(2);
  });

  it("does not count an entry from before a reload, which would load the whole page again", () => {
    recordNavigation("/transactions/t1", 2, false);
    browserList(["/accounts/a1", "/transactions/t1"], 1, 1);
    expect(stepsOutOf("/transactions/t1")).toBe(0);
  });

  it("keeps going back while it lands on one of them, when our stack came up short", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    pathname = "/accounts/a1";
    const tracker = render(createElement(HistoryTracker));
    const visit = (path: string) => {
      pathname = path;
      tracker.rerender(createElement(HistoryTracker));
    };
    window.history.pushState(null, "", "/transactions/t1/edit");
    visit("/transactions/t1/edit");

    leave("/transactions/t1");
    expect(go).toHaveBeenCalledWith(-1);
    visit("/transactions/t1");
    expect(back).toHaveBeenCalledTimes(1);
    visit("/accounts/a1");
    expect(canGoBack()).toBe(false);
    visit("/transactions/t1");
    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("goes back once when it is asked twice before the first one lands", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    recordNavigation("/accounts/a1", 2, false);
    recordNavigation("/transactions/t1", 3, false);
    recordNavigation("/transactions/t1/edit", 4, false);
    leave("/transactions/t1");
    leave("/transactions/t1");
    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(-2);
    expect(replace).not.toHaveBeenCalled();
  });

  it("forgets a leave that never landed, so the next one is not ignored", () => {
    vi.useFakeTimers();
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    recordNavigation("/accounts/a1", 2, false);
    recordNavigation("/transactions/t1", 3, false);
    leave("/transactions/t1");
    vi.advanceTimersByTime(5_000);
    recordNavigation("/transactions/t1", 4, false);
    leave("/transactions/t1");
    expect(go).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("replaces the page with the fallback when nothing of ours is behind it", () => {
    recordNavigation("/transactions/t1/edit", 2, false);
    leave("/transactions/t1");
    expect(replace).toHaveBeenCalledWith("/transactions");
  });
});
