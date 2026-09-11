"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditCategoryScreen } from "../../CategoryFormScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function EditCategoryRoute() {
  const id = useDetailRouteId();
  return id ? <EditCategoryScreen id={id} /> : null;
}
