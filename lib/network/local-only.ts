import { createStoredChoice } from "@/lib/storage/choice";

// The stored value stays "1", because a device that already chose this must not lose it.
const store = createStoredChoice("lf.localOnly", ["1", "0"] as const, "0");

// P-32 (owner, 2026-09-08): a device decision, so it lives beside the palette, not on the server.
export function isLocalOnly(): boolean {
  return store.get() === "1";
}

export function setLocalOnly(value: boolean): void {
  store.set(value ? "1" : "0");
}

export const localOnlyStore = {
  subscribe: store.subscribe,
  getSnapshot: isLocalOnly,
  getServerSnapshot: (): boolean => false,
};
