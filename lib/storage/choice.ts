type Listener = () => void;

export interface StoredChoice<T extends string> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  reset: () => void;
}

// D-5: a preference is the device's, so it lives here and never travels to the server (rule 9).
export function createStoredChoice<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): StoredChoice<T> {
  const listeners = new Set<Listener>();
  let cached: T | null = null;

  function read(): T {
    try {
      const stored = window.localStorage.getItem(key);
      return (values as readonly string[]).includes(stored ?? "") ? (stored as T) : fallback;
    } catch {
      // A browser that refuses storage cannot remember the choice, so it does not have one.
      return fallback;
    }
  }

  function get(): T {
    if (typeof window === "undefined") return fallback;
    cached ??= read();
    return cached;
  }

  return {
    get,
    set: (value: T) => {
      cached = value;
      try {
        if (value === fallback) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        // Nothing to do: the choice stays for this visit and the screen still shows what was chosen.
      }
      for (const listener of listeners) listener();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: get,
    getServerSnapshot: () => fallback,
    reset: () => {
      cached = null;
    },
  };
}
