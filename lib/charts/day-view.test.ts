import { dayView, dayViewStore, DEFAULT_DAY_VIEW, setDayView } from "./day-view";

const KEY = "lf.dayView";

beforeEach(() => {
  window.localStorage.clear();
  dayViewStore.reset();
});

describe("dayView", () => {
  it("starts on bars, which is what the server renders too", () => {
    expect(dayView()).toBe(DEFAULT_DAY_VIEW);
    expect(dayViewStore.getServerSnapshot()).toBe("bars");
  });

  it("remembers the choice in this browser and tells whoever is listening", () => {
    const listener = vi.fn();
    const stop = dayViewStore.subscribe(listener);
    setDayView("calendar");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(KEY)).toBe("calendar");
    dayViewStore.reset();
    expect(dayView()).toBe("calendar");
    stop();
  });

  it("ignores a stored value it does not know", () => {
    window.localStorage.setItem(KEY, "pie");
    expect(dayView()).toBe("bars");
  });

  it("keeps working when the browser refuses storage", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(dayView()).toBe("bars");
    setDayView("calendar");
    expect(dayView()).toBe("calendar");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
