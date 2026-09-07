import type { DrainOutcome, DrainReport } from "./engine";

// What the last round actually got onto the server, for the green stripe of §8.12 (F-62): it closes
// the circle the amber one opened — "2 changes waiting" becomes "2 changes synced" — and it is the
// only confirmation the user gets that the queue emptied.
type Listener = () => void;

// Everything that left the queue because the server has it now. `cancelled` is not here: a write
// undone before it left never reached anyone. `absorbed` is, because the user made that change and
// it did go up, folded into the one that carried it.
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

// Set, never accumulated: a round that drained nothing says zero, and the stripe then says only
// "Back online." — never "0 changes synced".
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
