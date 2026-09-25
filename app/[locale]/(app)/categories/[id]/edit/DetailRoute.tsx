"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditCategoryScreen } from "../../CategoryFormScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function EditCategoryRoute() {
  const id = useDetailRouteId();
  return id ? <EditCategoryScreen key={id} id={id} /> : null;
}
