import { isLocalOnly } from "./local-only";

export type ConnectivityPhase = "online" | "offline" | "back-online";

export const BACK_ONLINE_VISIBLE_MS = 3000;

type Listener = () => void;

const listeners = new Set<Listener>();
const suspectListeners = new Set<Listener>();
let phase: ConnectivityPhase = "online";
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let reported = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function setPhase(next: ConnectivityPhase): void {
  if (phase === next) return;
  phase = next;
  emit();
}

// P-32: `navigator.onLine` is only a hint, and a device the user put offline stays offline.
export function reportOnline(online: boolean): void {
  reported = true;
  if (online && isLocalOnly()) {
    setPhase("offline");
    return;
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!online) {
    setPhase("offline");
    return;
  }
  if (phase === "offline") {
    setPhase("back-online");
    timer = setTimeout(() => {
      timer = null;
      setPhase("online");
    }, BACK_ONLINE_VISIBLE_MS);
    return;
  }
  setPhase("online");
}

// A failed request is only a hint: the heartbeat decides whether the app is really offline.
export function reportNetworkFailure(): void {
  for (const listener of suspectListeners) listener();
}

// F-64: an answer proves the network is there, so the phase moves now instead of in 30 s.
export function reportNetworkAnswer(): void {
  if (phase !== "offline") return;
  for (const listener of suspectListeners) listener();
}

// `HEALTH_TIMEOUT_MS` for a request to a black hole, plus room for the round trip.
export const OFFLINE_VERDICT_MS = 6000;

// Reporting a failed request straight away files every lost connection as a fault of the app.
export function confirmOnline(graceMs = OFFLINE_VERDICT_MS): Promise<boolean> {
  if (phase === "offline") return Promise.resolve(false);
  return new Promise((resolve) => {
    const unsubscribe = connectivityStore.subscribe(() => {
      if (phase !== "offline") return;
      unsubscribe();
      resolve(false);
    });
    setTimeout(() => {
      unsubscribe();
      resolve(true);
    }, graceMs);
  });
}

export function onNetworkFailure(listener: Listener): () => void {
  suspectListeners.add(listener);
  return () => {
    suspectListeners.delete(listener);
  };
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  // P-32 first, and H-08: `navigator.onLine` is a hint and may not undo a report.
  if (!reported) phase = isLocalOnly() || !navigator.onLine ? "offline" : "online";
  window.addEventListener("online", () => {
    reportOnline(true);
  });
  window.addEventListener("offline", () => {
    reportOnline(false);
  });
}

export const connectivityStore = {
  subscribe: (listener: Listener): (() => void) => {
    start();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): ConnectivityPhase => phase,
  getServerSnapshot: (): ConnectivityPhase => "online",
  reset: (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    phase = "online";
    reported = false;
  },
};
