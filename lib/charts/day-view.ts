const KEY = "lf.dayView";

export const DAY_VIEWS = ["bars", "calendar"] as const;
export type DayView = (typeof DAY_VIEWS)[number];

export const DEFAULT_DAY_VIEW: DayView = "bars";

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: DayView | null = null;

function read(): DayView {
  try {
    const stored = window.localStorage.getItem(KEY);
    return (DAY_VIEWS as readonly string[]).includes(stored ?? "")
      ? (stored as DayView)
      : DEFAULT_DAY_VIEW;
  } catch {
    // A browser that refuses storage cannot remember the choice, so it does not have one.
    return DEFAULT_DAY_VIEW;
  }
}

// T-27 (owner, 2026-09-12): a per-browser choice, so it lives beside the palette, not on the server.
export function dayView(): DayView {
  if (typeof window === "undefined") return DEFAULT_DAY_VIEW;
  cached ??= read();
  return cached;
}

export function setDayView(value: DayView): void {
  cached = value;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Nothing to do: the choice stays for this visit and the card still shows what was chosen.
  }
  for (const listener of listeners) listener();
}

export const dayViewStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: dayView,
  getServerSnapshot: (): DayView => DEFAULT_DAY_VIEW,
  reset: (): void => {
    cached = null;
  },
};
