"use client";

import { useEffect, useState } from "react";

import { useOutbox } from "./outbox/useOutbox";
import { vaultReady } from "./repository";

// P-34: read through the vault gate (F-31) and the outbox store, never a poll.
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
