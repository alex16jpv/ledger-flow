"use client";

import { useSyncExternalStore } from "react";

import { usePathname } from "@/lib/i18n/navigation";

const noop = (): (() => void) => () => undefined;

// The id of a detail route, read from the URL and only on the client. The worker serves one cached
// document and one RSC payload per route template (F-48), so neither may carry an id: `params`
// would name the row the entry was made for, and the server HTML must not mention any row at all —
// which is why this answers null during the server render and the hydration that matches it.
export function useDetailRouteId(): string | null {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return pathname.split("/")[2] ?? null;
}
