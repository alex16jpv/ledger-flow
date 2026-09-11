"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { BudgetDetailScreen } from "./BudgetDetailScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function BudgetDetailRoute() {
  const id = useDetailRouteId();
  return id ? <BudgetDetailScreen id={id} /> : null;
}
