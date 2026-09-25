"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { BudgetDetailScreen } from "./BudgetDetailScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function BudgetDetailRoute() {
  const id = useDetailRouteId();
  return id ? <BudgetDetailScreen key={id} id={id} /> : null;
}
