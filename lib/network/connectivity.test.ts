import {
  BACK_ONLINE_VISIBLE_MS,
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

  it("ignores redundant online reports", () => {
    const listener = vi.fn();
    connectivityStore.subscribe(listener);
    reportOnline(true);
    reportOnline(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
