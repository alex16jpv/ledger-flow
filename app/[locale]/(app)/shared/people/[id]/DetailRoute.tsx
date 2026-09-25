"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { PersonScreen } from "./PersonScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function PersonRoute() {
  const id = useDetailRouteId();
  return id ? <PersonScreen key={id} id={id} /> : null;
}
