export type ConnectivityPhase = "online" | "offline" | "back-online";

export const BACK_ONLINE_VISIBLE_MS = 3000;

type Listener = () => void;

const listeners = new Set<Listener>();
const suspectListeners = new Set<Listener>();
let phase: ConnectivityPhase = "online";
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function setPhase(next: ConnectivityPhase): void {
  if (phase === next) return;
  phase = next;
  emit();
}

// navigator.onLine is only a hint; W-19 feeds this store from the /api/health heartbeat too.
export function reportOnline(online: boolean): void {
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

export function onNetworkFailure(listener: Listener): () => void {
  suspectListeners.add(listener);
  return () => {
    suspectListeners.delete(listener);
  };
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  phase = navigator.onLine ? "online" : "offline";
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
  },
};
