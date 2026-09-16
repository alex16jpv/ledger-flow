"use client";

import { useSyncExternalStore } from "react";

const NO_HOVER = "(hover: none)";

function media(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(NO_HOVER) : null;
}

function subscribe(listener: () => void): () => void {
  const query = media();
  query?.addEventListener("change", listener);
  return () => {
    query?.removeEventListener("change", listener);
  };
}

// T-80: only a device that declares it cannot hover loses the click; anything that declares nothing keeps it.
export function useCanHover(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !(media()?.matches ?? false),
    () => true,
  );
}
