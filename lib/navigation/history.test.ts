import { canGoBack, recordNavigation, resetHistoryForTests } from "./history";

beforeEach(() => {
  resetHistoryForTests();
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
