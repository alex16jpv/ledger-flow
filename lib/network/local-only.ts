const KEY = "lf.localOnly";

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: boolean | null = null;

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // A browser that refuses storage cannot remember the choice, so it does not have one.
    return false;
  }
}

// P-32 (owner, 2026-09-08): the user chose to keep working here, so the app behaves as it does with
// no network — reads from the mirror, writes to the queue, nothing leaves for `/api` — and the choice
// survives reloads until they change it. It is a device decision, so it lives beside the palette and
// the mode, not on the server.
export function isLocalOnly(): boolean {
  if (typeof window === "undefined") return false;
  cached ??= read();
  return cached;
}

export function setLocalOnly(value: boolean): void {
  cached = value;
  try {
    if (value) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the flag stays for this visit and the app still behaves as chosen.
  }
  for (const listener of listeners) listener();
}

export const localOnlyStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: isLocalOnly,
  getServerSnapshot: (): boolean => false,
};
