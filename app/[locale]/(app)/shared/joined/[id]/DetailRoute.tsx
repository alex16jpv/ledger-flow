"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { JoinedGroupScreen } from "./JoinedGroupScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function JoinedGroupRoute() {
  const id = useDetailRouteId();
  return id ? <JoinedGroupScreen id={id} /> : null;
}
