"use client";

import { useState } from "react";
import { invalidateDomain } from "@/lib/cache";

export default function SyncButton({
  onSync,
}: {
  onSync: () => Promise<void> | void;
}) {
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSync() {
    if (isSyncing) return;
    setIsSyncing(true);
    invalidateDomain("transactions");
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      aria-label="Sync transactions"
      title="Sync transactions"
      className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isSyncing ? "animate-spin" : ""}
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    </button>
  );
}
