import {
  BACK_ONLINE_VISIBLE_MS,
  confirmOnline,
  connectivityStore,
  onNetworkFailure,
  reportNetworkAnswer,
  reportOnline,
} from "./connectivity";

describe("connectivityStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectivityStore.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // H-08: `start()` runs on the first subscriber and used to overwrite the reported phase.
  it("keeps a phase reported before the first subscriber ever arrives", async () => {
    vi.resetModules();
    const fresh = await import("./connectivity");
    fresh.reportOnline(false);

    const stop = fresh.connectivityStore.subscribe(() => undefined);

    expect(fresh.connectivityStore.getSnapshot()).toBe("offline");
    stop();
  });

  it("goes offline, shows back-online briefly and settles on online", () => {
    const listener = vi.fn();
    connectivityStore.subscribe(listener);
    reportOnline(false);
    expect(connectivityStore.getSnapshot()).toBe("offline");
    reportOnline(true);
    expect(connectivityStore.getSnapshot()).toBe("back-online");
    vi.advanceTimersByTime(BACK_ONLINE_VISIBLE_MS);
    expect(connectivityStore.getSnapshot()).toBe("online");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("asks for a check when a request is answered, and only while it believes it is offline", () => {
    const check = vi.fn();
    const stop = onNetworkFailure(check);
    reportNetworkAnswer();
    expect(check).not.toHaveBeenCalled();
    reportOnline(false);
    reportNetworkAnswer();
    expect(check).toHaveBeenCalledTimes(1);
    stop();
  });

  it("hands the verdict to the heartbeat, and takes silence for an answer", async () => {
    const settled = vi.fn();
    void confirmOnline(1000).then(settled);
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledWith(true);
  });

  it("says the network is gone as soon as the heartbeat does, and without waiting when it knows", async () => {
    const settled = vi.fn();
    void confirmOnline(1000).then(settled);
    reportOnline(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalledWith(false);

    await expect(confirmOnline(1000)).resolves.toBe(false);
  });

  it("ignores redundant online reports", () => {
    const listener = vi.fn();
    connectivityStore.subscribe(listener);
    reportOnline(true);
    reportOnline(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
