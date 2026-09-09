import { beforeEach, describe, expect, it, vi } from "vitest";

import { connectivityStore, reportOnline } from "./connectivity";
import { isLocalOnly, localOnlyStore, setLocalOnly } from "./local-only";

describe("local-only mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocalOnly(false);
    reportOnline(true);
  });

  it("remembers the choice across reloads, because it is the device's and not the session's", () => {
    expect(isLocalOnly()).toBe(false);

    setLocalOnly(true);

    expect(isLocalOnly()).toBe(true);
    expect(window.localStorage.getItem("lf.localOnly")).toBe("1");
  });

  it("tells whoever is listening", () => {
    const listener = vi.fn();
    const stop = localOnlyStore.subscribe(listener);

    setLocalOnly(true);
    setLocalOnly(false);
    stop();
    setLocalOnly(true);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  // P-32: the whole point of the choice is that nothing talks the device back into being online —
  // the heartbeat, a request that answered, none of it.
  it("keeps the app offline while it lasts, and lets go when it is turned off", () => {
    setLocalOnly(true);
    reportOnline(true);

    expect(connectivityStore.getSnapshot()).toBe("offline");

    setLocalOnly(false);
    reportOnline(true);

    expect(connectivityStore.getSnapshot()).not.toBe("offline");
  });

  it("survives a browser that refuses storage", () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    setLocalOnly(true);

    expect(isLocalOnly()).toBe(true);
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
