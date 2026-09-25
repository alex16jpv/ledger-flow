import { useEffect, useState, useSyncExternalStore } from "react";

import { reportError } from "@/lib/observability/reporter";

import type { SuggestIndex } from "./index";
import type * as Store from "./store";

export type SuggestEngine = typeof Store;

let engine: SuggestEngine | null = null;
let loading: Promise<SuggestEngine> | null = null;

function loadEngine(): Promise<SuggestEngine> {
  loading ??= import("./store").then((module) => {
    engine = module;
    return module;
  });
  return loading;
}

export function useSuggestEngine(wanted: boolean): SuggestEngine | null {
  const [loaded, setLoaded] = useState(engine);
  useEffect(() => {
    if (!wanted || loaded) return undefined;
    let live = true;
    loadEngine().then(
      (module) => {
        if (live) setLoaded(module);
      },
      (error: unknown) => {
        reportError(error, "network");
      },
    );
    return () => {
      live = false;
    };
  }, [wanted, loaded]);
  return loaded;
}

const NO_STORE = {
  subscribe: (): (() => void) => () => undefined,
  getSnapshot: (): SuggestIndex | null => null,
};

export function useSuggestIndex(loaded: SuggestEngine | null): SuggestIndex | null {
  const store = loaded?.suggestStore ?? NO_STORE;
  return useSyncExternalStore(store.subscribe, store.getSnapshot, NO_STORE.getSnapshot);
}
