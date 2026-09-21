"use client";

import { PersonScreen } from "@/features/shared/components/PersonScreen";
import { useDetailRouteId } from "@/lib/navigation/detail";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function PersonRoute() {
  const id = useDetailRouteId();
  return id ? <PersonScreen id={id} /> : null;
}
