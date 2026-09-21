"use client";

import { SharedGroupScreen } from "@/features/shared/components/SharedGroupScreen";
import { useDetailRouteId } from "@/lib/navigation/detail";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function SharedGroupRoute() {
  const id = useDetailRouteId();
  return id ? <SharedGroupScreen id={id} /> : null;
}
