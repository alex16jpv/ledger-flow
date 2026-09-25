import { reportError } from "@/lib/observability/reporter";

import { activateWaitingWorker } from "./registration";
import {
  applyUpdate,
  dismissUpdate,
  reportUpdateWaiting,
  resurfaceUpdate,
  updateStore,
} from "./update";

vi.mock("./registration", () => ({ activateWaitingWorker: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/observability/reporter", () => ({ reportError: vi.fn() }));

const reload = vi.fn();

afterEach(() => {
  updateStore.reset();
  vi.unstubAllGlobals();
  reload.mockReset();
  vi.mocked(reportError).mockReset();
  vi.mocked(activateWaitingWorker).mockClear();
});

describe("the new-version notice", () => {
  it("says nothing until a new version is waiting", () => {
    expect(updateStore.getSnapshot()).toBe("none");
    resurfaceUpdate();
    dismissUpdate();
    expect(updateStore.getSnapshot()).toBe("none");
  });

  it("is put away by the user and comes back when they return", () => {
    const listener = vi.fn();
    const stop = updateStore.subscribe(listener);
    reportUpdateWaiting();
    expect(updateStore.getSnapshot()).toBe("shown");

    dismissUpdate();
    expect(updateStore.getSnapshot()).toBe("dismissed");

    resurfaceUpdate();
    expect(updateStore.getSnapshot()).toBe("shown");
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });

  it("shows again for a newer version even after being put away", () => {
    reportUpdateWaiting();
    dismissUpdate();
    reportUpdateWaiting();
    expect(updateStore.getSnapshot()).toBe("shown");
  });

  it("does not wake anyone when nothing changes", () => {
    reportUpdateWaiting();
    const listener = vi.fn();
    const stop = updateStore.subscribe(listener);
    reportUpdateWaiting();
    resurfaceUpdate();
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it("is never shown while rendering on the server", () => {
    reportUpdateWaiting();
    expect(updateStore.getServerSnapshot()).toBe("none");
  });

  it("activates the waiting version on Reload", async () => {
    applyUpdate();
    await vi.waitFor(() => {
      expect(activateWaitingWorker).toHaveBeenCalledTimes(1);
    });
  });

  it("never leaves Reload dead: a failure is reported and the page reloads", async () => {
    vi.stubGlobal("location", { href: window.location.href, reload });
    const failure = new Error("chunk failed");
    vi.mocked(activateWaitingWorker).mockRejectedValueOnce(failure);
    applyUpdate();
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
    expect(reportError).toHaveBeenCalledWith(failure, "worker");
  });
});
