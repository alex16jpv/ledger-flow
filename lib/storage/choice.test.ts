import { createStoredChoice } from "./choice";

const VALUES = ["bars", "calendar"] as const;
const KEY = "lf.test.choice";

function make() {
  return createStoredChoice(KEY, VALUES, "bars");
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("createStoredChoice", () => {
  it("starts on the fallback, which is what the server renders too", () => {
    const store = make();
    expect(store.get()).toBe("bars");
    expect(store.getServerSnapshot()).toBe("bars");
  });

  it("remembers a choice in this browser and tells whoever is listening", () => {
    const store = make();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.set("calendar");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(KEY)).toBe("calendar");
    expect(make().get()).toBe("calendar");
    stop();
    store.set("bars");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("leaves nothing behind when the choice is the default one", () => {
    const store = make();
    store.set("calendar");
    store.set("bars");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("ignores a stored value it does not know", () => {
    window.localStorage.setItem(KEY, "pie");
    expect(make().get()).toBe("bars");
  });

  it("keeps working when the browser refuses storage", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const store = make();
    expect(store.get()).toBe("bars");
    store.set("calendar");
    expect(store.get()).toBe("calendar");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
