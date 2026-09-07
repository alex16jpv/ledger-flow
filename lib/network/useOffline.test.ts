import { act, renderHook } from "@testing-library/react";

import { connectivityStore, reportOnline } from "./connectivity";
import { useOffline } from "./useOffline";

afterEach(() => {
  connectivityStore.reset();
});

describe("useOffline", () => {
  it("follows the connectivity store, and only its offline phase", () => {
    const { result } = renderHook(() => useOffline());
    expect(result.current).toBe(false);
    act(() => {
      reportOnline(false);
    });
    expect(result.current).toBe(true);
    act(() => {
      reportOnline(true);
    });
    // "back-online" is still a connection.
    expect(result.current).toBe(false);
  });
});
