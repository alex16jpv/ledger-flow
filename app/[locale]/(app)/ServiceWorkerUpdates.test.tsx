import { render, waitFor } from "@testing-library/react";

import { checkForUpdatesOnReturn, registerServiceWorker } from "@/lib/pwa/registration";
import { reportUpdateWaiting, resurfaceUpdate } from "@/lib/pwa/update";

import { ServiceWorkerUpdates } from "./ServiceWorkerUpdates";

const environment = vi.hoisted(() => ({ value: "production" }));
vi.mock("@/lib/flags", () => ({
  get appEnvironment() {
    return environment.value;
  },
}));

const stop = vi.fn();
const registration = {};
vi.mock("@/lib/pwa/registration", () => ({
  registerServiceWorker: vi.fn(() => Promise.resolve(registration)),
  checkForUpdatesOnReturn: vi.fn(() => stop),
}));

afterEach(() => {
  environment.value = "production";
  vi.mocked(registerServiceWorker).mockClear();
  vi.mocked(checkForUpdatesOnReturn).mockClear();
  stop.mockReset();
});

describe("ServiceWorkerUpdates", () => {
  it("registers the worker, watches for returns, and stops watching when it leaves", async () => {
    const { unmount } = render(<ServiceWorkerUpdates />);
    await waitFor(() => {
      expect(checkForUpdatesOnReturn).toHaveBeenCalledWith(registration, resurfaceUpdate);
    });
    expect(registerServiceWorker).toHaveBeenCalledWith(reportUpdateWaiting);

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("does not start watching if it left before the worker was registered", async () => {
    const { unmount } = render(<ServiceWorkerUpdates />);
    unmount();
    await waitFor(() => {
      expect(registerServiceWorker).toHaveBeenCalled();
    });
    await Promise.resolve();
    expect(checkForUpdatesOnReturn).not.toHaveBeenCalled();
  });

  it("installs no worker outside production, the e2e build included", async () => {
    environment.value = "test";
    render(<ServiceWorkerUpdates />);
    await Promise.resolve();
    expect(registerServiceWorker).not.toHaveBeenCalled();
  });
});
