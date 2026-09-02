import { BACK_ONLINE_VISIBLE_MS, connectivityStore, reportOnline } from "./connectivity";

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

  it("ignores redundant online reports", () => {
    const listener = vi.fn();
    connectivityStore.subscribe(listener);
    reportOnline(true);
    reportOnline(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
