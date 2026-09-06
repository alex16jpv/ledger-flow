"use client";

import { useSyncExternalStore } from "react";

import { connectivityStore } from "./connectivity";

// For the few actions that need the server itself (F-20, sign-out): they say so and wait, instead
// of failing with a network error or, worse, looking as if they had worked.
export function useOffline(): boolean {
  return (
    useSyncExternalStore(
      connectivityStore.subscribe,
      connectivityStore.getSnapshot,
      connectivityStore.getServerSnapshot,
    ) === "offline"
  );
}
