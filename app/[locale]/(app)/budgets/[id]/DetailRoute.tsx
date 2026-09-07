"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { BudgetDetailScreen } from "./BudgetDetailScreen";

// The id comes from the URL, not from `params`: the worker serves this route from one entry per
// template, so the payload cannot know which row it is (F-48).
export function BudgetDetailRoute() {
  const id = useDetailRouteId();
  return id ? <BudgetDetailScreen id={id} /> : null;
}
