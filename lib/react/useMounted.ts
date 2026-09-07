"use client";

import { useSyncExternalStore } from "react";

const noop = (): (() => void) => () => undefined;

// False during the server render and the hydration that has to match it, true from the first client
// render on. What hangs on it is anything the server cannot know for the document it is serving:
// the worker answers an (app) route from one cached document per template (D-28), so the URL the
// page hydrates under — its query, its row id — is not the one the HTML was rendered for.
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
