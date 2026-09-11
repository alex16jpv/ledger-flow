import type { DrainOutcome, DrainReport } from "./engine";

// F-62: the green stripe of §8.12 is the only confirmation the user gets that the queue emptied.
type Listener = () => void;

// `cancelled` is out — it never reached anyone; `absorbed` is in — it went up, folded in.
const SETTLED = new Set<DrainOutcome["kind"]>(["sent", "landed", "gone", "merged", "absorbed"]);

const listeners = new Set<Listener>();
let synced = 0;

export const syncedStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): number => synced,
  getServerSnapshot: (): number => 0,
};

// Set, never accumulated: a round that drained nothing says zero, never 0 changes synced.
export function reportSynced(report: DrainReport): void {
  const next = [...report.values()].filter((outcome) => SETTLED.has(outcome.kind)).length;
  if (synced === next) return;
  synced = next;
  for (const listener of listeners) listener();
}

export function resetSynced(): void {
  if (synced === 0) return;
  synced = 0;
  for (const listener of listeners) listener();
}
