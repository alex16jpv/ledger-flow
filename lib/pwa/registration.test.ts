import {
  activateWaitingWorker,
  checkForUpdatesOnReturn,
  registerServiceWorker,
  UPDATE_CHECK_INTERVAL_MS,
} from "./registration";

const reportError = vi.fn();
vi.mock("@/lib/observability/reporter", () => ({
  reportError: (...args: unknown[]) => {
    reportError(...args);
  },
}));

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = "installing";
  postMessage = vi.fn();

  become(state: ServiceWorkerState): void {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  update = vi.fn(() => Promise.resolve());
}

class FakeContainer extends EventTarget {
  controller: object | null = {};
  registration = new FakeRegistration();
  register = vi.fn(() => Promise.resolve(this.registration));
  getRegistration = vi.fn(() => Promise.resolve(this.registration));
}

let container: FakeContainer;
const reload = vi.fn();

const asRegistration = (registration: FakeRegistration) =>
  registration as unknown as ServiceWorkerRegistration;

const setVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  container = new FakeContainer();
  Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });
  vi.stubGlobal("location", { href: window.location.href, reload });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(document, "visibilityState");
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  reload.mockReset();
  reportError.mockReset();
});

describe("registerServiceWorker", () => {
  it("reports a version that was already waiting when the app opened", async () => {
    container.registration.waiting = new FakeWorker();
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("reports a version once it finishes installing", async () => {
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);
    const worker = new FakeWorker();
    container.registration.installing = worker;
    container.registration.dispatchEvent(new Event("updatefound"));
    expect(onUpdate).not.toHaveBeenCalled();

    worker.become("installed");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("says nothing when the first install finishes, since nothing older is running", async () => {
    container.controller = null;
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);
    const worker = new FakeWorker();
    container.registration.installing = worker;
    container.registration.dispatchEvent(new Event("updatefound"));
    worker.become("installed");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("says nothing on the first install, when no version was running yet", async () => {
    container.controller = null;
    container.registration.waiting = new FakeWorker();
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("checkForUpdatesOnReturn", () => {
  it("brings the notice back on every return and looks for a version at most every few minutes", () => {
    vi.useFakeTimers();
    const registration = container.registration;
    const onReturn = vi.fn();
    const stop = checkForUpdatesOnReturn(asRegistration(registration), onReturn);

    setVisibility("hidden");
    expect(onReturn).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(registration.update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    setVisibility("visible");
    setVisibility("visible");
    expect(onReturn).toHaveBeenCalledTimes(3);
    expect(registration.update).toHaveBeenCalledTimes(1);

    stop();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    setVisibility("visible");
    expect(onReturn).toHaveBeenCalledTimes(3);
  });

  it("drops a check that fails with no network, and reports one that fails with it", async () => {
    vi.useFakeTimers();
    const registration = container.registration;
    const failure = new TypeError("Failed to fetch");
    registration.update.mockRejectedValue(failure);
    checkForUpdatesOnReturn(asRegistration(registration), vi.fn());

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    setVisibility("visible");
    await vi.runAllTimersAsync();
    expect(reportError).not.toHaveBeenCalled();

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    setVisibility("visible");
    await vi.runAllTimersAsync();
    expect(registration.update).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledWith(failure, "worker");
  });
});

describe("activateWaitingWorker", () => {
  it("activates the waiting version and reloads once it takes over", async () => {
    const waiting = new FakeWorker();
    container.registration.waiting = waiting;
    await activateWaitingWorker();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();

    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("just reloads when another tab already activated it", async () => {
    await activateWaitingWorker();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
