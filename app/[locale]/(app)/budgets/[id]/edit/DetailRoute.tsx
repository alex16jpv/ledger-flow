"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditBudgetScreen } from "../../BudgetFormScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function EditBudgetRoute() {
  const id = useDetailRouteId();
  return id ? <EditBudgetScreen key={id} id={id} /> : null;
}
