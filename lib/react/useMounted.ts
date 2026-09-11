"use client";

import { useSyncExternalStore } from "react";

const noop = (): (() => void) => () => undefined;

// D-28: the worker answers an `(app)` route from one document per template, so the URL may differ.
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
