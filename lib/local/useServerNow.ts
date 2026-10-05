"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { settledClockStore } from "./clock";

export function useServerNow(): Date {
  const offset = useSyncExternalStore(
    settledClockStore.subscribe,
    settledClockStore.getSnapshot,
    settledClockStore.getServerSnapshot,
  );
  const [openedAt] = useState(() => Date.now());
  return useMemo(() => new Date(openedAt - offset), [openedAt, offset]);
}
