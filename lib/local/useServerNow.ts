"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { clockStore } from "./clock";

// T-163: the current period is the server's, whatever this device's clock says.
export function useServerNow(): Date {
  const offset = useSyncExternalStore(
    clockStore.subscribe,
    clockStore.getSnapshot,
    clockStore.getServerSnapshot,
  );
  const [openedAt] = useState(() => Date.now());
  return useMemo(() => new Date(openedAt - offset), [openedAt, offset]);
}
