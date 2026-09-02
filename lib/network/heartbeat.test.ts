import { onlineManager } from "@tanstack/react-query";

import { connectivityStore, reportNetworkFailure, reportOnline } from "./connectivity";
import { HEARTBEAT_INTERVAL_MS, startHeartbeat } from "./heartbeat";

describe("heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectivityStore.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });

  it("pings after a failed request, pauses React Query while offline and polls until the API answers", async () => {
    const check = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
    const stop = startHeartbeat(check);
    expect(onlineManager.isOnline()).toBe(true);

    reportNetworkFailure();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    expect(connectivityStore.getSnapshot()).toBe("offline");
    expect(onlineManager.isOnline()).toBe(false);

    check.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(2);
    expect(connectivityStore.getSnapshot()).toBe("back-online");
    expect(onlineManager.isOnline()).toBe(true);
    stop();
  });

  it("re-checks on focus only while offline", async () => {
    const check = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    const stop = startHeartbeat(check);
    window.dispatchEvent(new Event("focus"));
    expect(check).not.toHaveBeenCalled();
    reportOnline(false);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    stop();
  });
});
