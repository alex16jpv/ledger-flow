import type { VaultDb } from "./outbox/queue";

// Trap 7.4 of the offline plan, the half that was never built (F-66): a form can only check a date
// against the clock it runs on, so a device three days ahead accepts what the server will refuse.
// Every answer the server gives carries its own clock, so the distance between the two is knowable;
// it lives in the vault because the form needs it exactly when there is no network left to ask.
const OFFSET_KEY = "clockOffsetMs";

// Under an hour nothing is at stake: the server refuses dates more than 24 h ahead, and a minute of
// drift is normal on any device.
export const CLOCK_SKEW_MIN_MS = 60 * 60 * 1000;

// Rewritten only when it moved by more than a minute: the answer to every round would otherwise be
// a write.
const WORTH_STORING_MS = 60 * 1000;

type Listener = () => void;

const listeners = new Set<Listener>();
let offsetMs = 0;

function publish(next: number): void {
  if (offsetMs === next) return;
  offsetMs = next;
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

export function resetClockOffset(): void {
  publish(0);
}

// What the server's clock says right now, as far as this device can tell.
export const serverNow = (now: number = Date.now()): number => now - offsetMs;

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

// How far ahead of the server this device runs, in the coarsest unit that says it, or null when the
// distance is too small to matter.
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
