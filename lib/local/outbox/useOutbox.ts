"use client";

import { useSyncExternalStore } from "react";

import { type OutboxStatus, outboxStatusStore } from "./status";

// It never opens IndexedDB: the store is refreshed by the writes.
export function useOutbox(): OutboxStatus {
  return useSyncExternalStore(
    outboxStatusStore.subscribe,
    outboxStatusStore.getSnapshot,
    outboxStatusStore.getServerSnapshot,
  );
}
