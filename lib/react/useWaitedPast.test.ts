import { act, renderHook } from "@testing-library/react";

import { useWaitedPast } from "./useWaitedPast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useWaitedPast (T-264)", () => {
  it("says so once the wait outlasts its patience, and keeps saying it", () => {
    const { result, rerender } = renderHook(({ waiting }) => useWaitedPast(waiting, 3000), {
      initialProps: { waiting: true },
    });

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);

    rerender({ waiting: false });
    expect(result.current).toBe(true);
  });

  it("never fires for a wait that ended in time", () => {
    const { result, rerender } = renderHook(({ waiting }) => useWaitedPast(waiting, 3000), {
      initialProps: { waiting: true },
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ waiting: false });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBe(false);
  });
});
