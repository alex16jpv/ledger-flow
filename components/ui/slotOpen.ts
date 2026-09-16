"use client";

import { type MouseEvent, useSyncExternalStore } from "react";

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

// T-80: only a device that declares it cannot hover loses the tap; anything that declares nothing keeps it.
export function useCanHover(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !(media()?.matches ?? false),
    () => true,
  );
}

export function useSlotOpen(
  onSelect: ((index: number) => void) | undefined,
): ((index: number) => (event: MouseEvent<HTMLElement>) => void) | undefined {
  const canHover = useCanHover();
  if (onSelect === undefined) return undefined;
  // A keyboard or an assistive activation carries `detail === 0`; a finger's tap carries 1.
  return (index) => (event) => {
    if (canHover || event.detail === 0) onSelect(index);
  };
}
