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

  it("has nowhere to go when every entry of ours is one of them", () => {
    recordNavigation("/transactions/t1/edit", 2, false);
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

    renderHook(() => useLeaveNavigation()).result.current("/transactions/t1", "/transactions");
    expect(go).toHaveBeenCalledWith(-1);
    visit("/transactions/t1");
    expect(back).toHaveBeenCalledTimes(1);
    visit("/accounts/a1");
    expect(back).toHaveBeenCalledTimes(1);
    expect(canGoBack()).toBe(false);
    visit("/transactions/t1");
    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    go.mockRestore();
    back.mockRestore();
  });

  it("replaces the page with the fallback when nothing of ours is behind it", () => {
    recordNavigation("/transactions/t1/edit", 2, false);
    renderHook(() => useLeaveNavigation()).result.current("/transactions/t1", "/transactions");
    expect(replace).toHaveBeenCalledWith("/transactions");
  });
});
