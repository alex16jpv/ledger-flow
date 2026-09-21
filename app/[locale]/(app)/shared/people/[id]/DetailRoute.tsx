"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { PersonScreen } from "./PersonScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function PersonRoute() {
  const id = useDetailRouteId();
  return id ? <PersonScreen id={id} /> : null;
}
