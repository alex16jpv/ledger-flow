"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditAccountScreen } from "../../AccountFormScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function EditAccountRoute() {
  const id = useDetailRouteId();
  return id ? <EditAccountScreen id={id} /> : null;
}
