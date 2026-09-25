import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import type { StatsResponse } from "@/types/api";

import type * as Api from "./api";
import { fetchDailyStats } from "./api";
import { usePeriodTotals } from "./hooks";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof Api>()),
  fetchDailyStats: vi.fn(),
}));

const day = (total: number): StatsResponse =>
  ({ total, buckets: [{ key: "2026-09-10", total, count: 1 }] }) as unknown as StatsResponse;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children);
}

describe("usePeriodTotals", () => {
  it("nets each day in cents, so a day with cents leaves no residue [T-158]", async () => {
    vi.mocked(fetchDailyStats).mockImplementation(({ type }) =>
      Promise.resolve(type === "INCOME" ? day(0.3) : day(0.1)),
    );
    const { result } = renderHook(() => usePeriodTotals({ from: "2026-09-01", to: "2026-09-30" }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current?.byDay.get("2026-09-10")).toBe(0.2);
  });
});
