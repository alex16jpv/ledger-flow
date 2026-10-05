import { act, renderHook } from "@testing-library/react";

import { rememberServerTime, resetClockOffset } from "./clock";
import type { VaultDb } from "./outbox/queue";
import { useServerNow } from "./useServerNow";

const vault = { put: vi.fn() } as unknown as VaultDb;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
});

afterEach(() => {
  resetClockOffset();
  vi.useRealTimers();
});

describe("useServerNow (T-163)", () => {
  it("is this device's time while nothing has said the server's", () => {
    const { result } = renderHook(() => useServerNow());

    expect(result.current.toISOString()).toBe("2026-10-02T12:00:00.000Z");
  });

  it("moves to the server's time as soon as an answer tells it, and stays put between renders", async () => {
    const { result, rerender } = renderHook(() => useServerNow());

    await act(() => rememberServerTime(vault, "2026-09-30T12:00:00.000Z"));
    const first = result.current;
    vi.setSystemTime(new Date("2026-10-02T12:05:00.000Z"));
    rerender();

    expect(first.toISOString()).toBe("2026-09-30T12:00:00.000Z");
    expect(result.current).toBe(first);
  });

  it("does not move for the few milliseconds each answer's latency adds", async () => {
    const { result, rerender } = renderHook(() => useServerNow());
    await act(() => rememberServerTime(vault, "2026-09-30T12:00:00.000Z"));
    const settled = result.current;

    await act(() => rememberServerTime(vault, "2026-09-30T11:59:59.950Z"));
    rerender();

    expect(result.current).toBe(settled);
  });
});
