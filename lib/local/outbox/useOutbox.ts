"use client";

import { useSyncExternalStore } from "react";

import { type OutboxStatus, outboxStatusStore } from "./status";

// What the queue holds right now, so a screen can say which of its figures are projections and the
// banner can count what is waiting. It never opens IndexedDB: the store is refreshed by the writes.
export function useOutbox(): OutboxStatus {
  return useSyncExternalStore(
    outboxStatusStore.subscribe,
    outboxStatusStore.getSnapshot,
    outboxStatusStore.getServerSnapshot,
  );
}
