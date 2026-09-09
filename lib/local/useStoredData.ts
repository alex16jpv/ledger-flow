"use client";

import { useEffect, useState } from "react";

import { useOutbox } from "./outbox/useOutbox";
import { vaultReady } from "./repository";

// P-34: whether this device has anything to lose — a full copy the pull left behind, or writes still
// waiting. Both are read the way the rest of the app reads them: the vault gate (F-31) and the
// outbox store, never a poll.
export function useStoredData(): boolean {
  const outbox = useOutbox();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const state = { cancelled: false };
    void (async () => {
      const vault = await vaultReady();
      const stamp = await vault?.db.get("meta", "syncedAt");
      if (!state.cancelled) setCopied(typeof stamp?.value === "string");
    })();
    return () => {
      state.cancelled = true;
    };
  }, []);

  return copied || outbox.pending > 0 || outbox.attention > 0;
}
