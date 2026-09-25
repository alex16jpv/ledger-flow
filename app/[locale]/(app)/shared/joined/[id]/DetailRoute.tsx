"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { JoinedGroupScreen } from "./JoinedGroupScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function JoinedGroupRoute() {
  const id = useDetailRouteId();
  return id ? <JoinedGroupScreen key={id} id={id} /> : null;
}
