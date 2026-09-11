"use client";

import { useSyncExternalStore } from "react";

import { connectivityStore } from "./connectivity";

// F-20 and sign-out: they say so and wait rather than look as if they had worked.
export function useOffline(): boolean {
  return (
    useSyncExternalStore(
      connectivityStore.subscribe,
      connectivityStore.getSnapshot,
      connectivityStore.getServerSnapshot,
    ) === "offline"
  );
}
