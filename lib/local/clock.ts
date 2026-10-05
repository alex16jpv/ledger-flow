import type { VaultDb } from "./outbox/queue";

// F-66 (trap 7.4): the offset lives in the vault because the form needs it with no network left.
const OFFSET_KEY = "clockOffsetMs";

// Under an hour nothing is at stake: the server refuses dates more than 24 h ahead.
export const CLOCK_SKEW_MIN_MS = 60 * 60 * 1000;

// Rewritten only past a minute of movement, or every round would end in a write.
const WORTH_STORING_MS = 60 * 1000;

type Listener = () => void;

const listeners = new Set<Listener>();
let offsetMs = 0;
// Screens key their queries on "now", so the latency of each answer must not move it.
let settledOffsetMs = 0;

function publish(next: number): void {
  if (offsetMs === next) return;
  offsetMs = next;
  if (Math.abs(next - settledOffsetMs) >= WORTH_STORING_MS) settledOffsetMs = next;
  for (const listener of listeners) listener();
}

// Positive means this device runs ahead of the server.
export const clockOffsetMs = (): number => offsetMs;

export const clockStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): number => offsetMs,
  getServerSnapshot: (): number => 0,
};

export const settledClockStore = {
  subscribe: clockStore.subscribe,
  getSnapshot: (): number => settledOffsetMs,
  getServerSnapshot: (): number => 0,
};

export function resetClockOffset(): void {
  settledOffsetMs = 0;
  publish(0);
}

// What the server's clock says right now, as far as this device can tell.
export const serverNow = (now: number = Date.now()): number => now - offsetMs;

export function secondsUntilServer(at: string | null | undefined): number {
  const when = at ? Date.parse(at) : Number.NaN;
  return Number.isNaN(when) ? 0 : Math.max(0, Math.ceil((when - serverNow()) / 1000));
}

export async function rememberServerTime(
  db: VaultDb,
  serverTime: string,
  now: number = Date.now(),
): Promise<void> {
  const at = Date.parse(serverTime);
  if (Number.isNaN(at)) return;
  const next = now - at;
  const stored = offsetMs;
  publish(next);
  if (Math.abs(next - stored) < WORTH_STORING_MS) return;
  await db.put("meta", { key: OFFSET_KEY, value: next });
}

export interface ClockSkew {
  unit: "days" | "hours";
  count: number;
}

// The coarsest unit that says it, or null when the distance is too small to matter.
export function aheadOfServer(offset: number = clockOffsetMs()): ClockSkew | null {
  if (offset < CLOCK_SKEW_MIN_MS) return null;
  const hours = Math.round(offset / (60 * 60 * 1000));
  return hours >= 24
    ? { unit: "days", count: Math.round(hours / 24) }
    : { unit: "hours", count: hours };
}

export async function loadClockOffset(db: VaultDb): Promise<void> {
  const stored = await db.get("meta", OFFSET_KEY);
  publish(typeof stored?.value === "number" ? stored.value : 0);
}
