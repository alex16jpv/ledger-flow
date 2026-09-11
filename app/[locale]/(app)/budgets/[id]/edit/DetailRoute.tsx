"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditBudgetScreen } from "../../BudgetFormScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function EditBudgetRoute() {
  const id = useDetailRouteId();
  return id ? <EditBudgetScreen id={id} /> : null;
}
