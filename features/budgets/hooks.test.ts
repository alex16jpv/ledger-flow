import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { budgetSuggestions, roundToNice } from "./form";
import { useBudgetQuery } from "./hooks";
import { budgetKeys } from "./keys";
import { budgetAmountSchema } from "./schemas";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children);
}

describe("budgets", () => {
  it("nests keys under the feature root", () => {
    expect(budgetKeys.list()[0]).toBe("budgets");
  });

  it("requires a positive amount", () => {
    expect(budgetAmountSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(budgetAmountSchema.safeParse({ amount: 2_000_000 }).success).toBe(true);
  });

  it("scales suggestions by currency, not by decimals (F-01)", () => {
    expect(budgetSuggestions("COP", 0)).toEqual([1_500_000, 2_000_000, 3_000_000]);
    expect(budgetSuggestions("MXN", 2)).toEqual([15_000, 20_000, 30_000]);
    expect(budgetSuggestions("USD", 2)).toEqual([1_500, 2_000, 3_000]);
    expect(budgetSuggestions("XAF", 0)).toEqual([150_000, 200_000, 300_000]);
  });

  it("asks the server for nothing when there is no budget id (H-15)", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useBudgetQuery(""), { wrapper });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
    vi.unstubAllGlobals();
  });

  it("prefers last month's spending, rounded to a friendly figure", () => {
    expect(roundToNice(1_284_300)).toBe(1_500_000);
    expect(roundToNice(742)).toBe(750);
    expect(budgetSuggestions("COP", 0, 1_284_300)).toEqual(
      [1_000_000, 1_500_000, 1_500_000].filter((value, index, all) => all.indexOf(value) === index),
    );
    expect(budgetSuggestions("COP", 0, 0)).toEqual([1_500_000, 2_000_000, 3_000_000]);
  });
});
