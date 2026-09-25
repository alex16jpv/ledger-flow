"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditAccountScreen } from "../../AccountFormScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function EditAccountRoute() {
  const id = useDetailRouteId();
  return id ? <EditAccountScreen key={id} id={id} /> : null;
}
